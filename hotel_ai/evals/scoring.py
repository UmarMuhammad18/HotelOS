"""
Eval scoring — turn an `expect:` block from a YAML fixture into a list of
pass/fail checks against a `Plan`.

The scorer is intentionally "small contract, lots of cases": every assertion
type is one branch, each branch is independent, and any unknown key shows up
as a failed check rather than silently passing. That way fixture authors get
loud feedback when they typo a key name.

Supported keys (all optional — only the ones present are checked):

  agent_includes:        list[str]   at least one action.department equals each
  agent_excludes:        list[str]   no action.department equals any of these
  priority_at_most:      str         every action.priority <= given (low<normal<high<urgent)
  priority_at_least:     str         every action.priority >= given
  emergency:             bool        any action.priority == 'urgent'
  reply_locale:          str         plan.guest_reply.locale == given
  reply_in_language:     str         langdetect(plan.guest_reply.message) == given
  tool_called:           str         expected MemoryUpdate.kind appears in plan.memory_updates
  reply_contains:        list[str]   plan.guest_reply.message contains each substring (case-insensitive)
  reply_excludes:        list[str]   plan.guest_reply.message excludes each substring (case-insensitive)
  intent:                str         plan.intent == given (LLM-classified intent)
  sentiment:             str         plan.sentiment == given
  min_actions:           int         len(plan.actions) >= n
  max_actions:           int         len(plan.actions) <= n
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Keep this import light — the scorer must work without an LLM. The Plan
# import is the only thing we need at type-check time.
try:  # langdetect is optional at import time so unit tests of the scorer
    from langdetect import DetectorFactory, detect  # type: ignore

    DetectorFactory.seed = 0  # deterministic detection
    _HAS_LANGDETECT = True
except Exception:  # pragma: no cover - optional dep
    _HAS_LANGDETECT = False


_PRIORITY_RANK = {"low": 0, "normal": 1, "high": 2, "urgent": 3, "emergency": 3}


# Reverse map: AgentEvent.agent display name (lowercased) → department code.
# Mirrors DISPLAY_NAME in app/agents/orchestrator.py. Used to derive which
# departments were dispatched, since `plan.events[*].agent` is the only
# place Plan exposes that information after agent fan-out.
_DISPLAY_TO_DEPT = {
    "front desk ai": "front_desk",
    "housekeeping ai": "housekeeping",
    "concierge ai": "concierge",
    "maintenance ai": "maintenance",
    "room service ai": "food_beverage",
    "guest experience": "guest_relations",
    "security ai": "security",
    "accessibility ai": "accessibility",
    "revenue ai": "revenue",
    "reservations ai": "reservations",
    "spa ai": "spa",
}

# Agents in plan.events that we DON'T count as a dispatched department.
_NON_AGENT_DISPLAY = {"orchestrator"}


@dataclass
class CheckResult:
    name: str
    passed: bool
    detail: str = ""

    def line(self) -> str:
        marker = "PASS" if self.passed else "FAIL"
        suffix = f" — {self.detail}" if self.detail else ""
        return f"  [{marker}] {self.name}{suffix}"


def check(expect: dict[str, Any], plan: Any) -> list[CheckResult]:
    """Run every assertion in `expect` against `plan` and return one
    CheckResult per assertion. Unknown keys produce a failing result."""
    results: list[CheckResult] = []

    if expect is None:
        return results

    for key, value in expect.items():
        try:
            if key == "agent_includes":
                results.append(_check_agent_includes(plan, value))
            elif key == "agent_excludes":
                results.append(_check_agent_excludes(plan, value))
            elif key == "priority_at_most":
                results.append(_check_priority_at_most(plan, value))
            elif key == "priority_at_least":
                results.append(_check_priority_at_least(plan, value))
            elif key == "emergency":
                results.append(_check_emergency(plan, value))
            elif key == "reply_locale":
                results.append(_check_reply_locale(plan, value))
            elif key == "reply_in_language":
                results.append(_check_reply_in_language(plan, value))
            elif key == "tool_called":
                results.append(_check_tool_called(plan, value))
            elif key == "reply_contains":
                results.append(_check_reply_contains(plan, value))
            elif key == "reply_excludes":
                results.append(_check_reply_excludes(plan, value))
            elif key == "intent":
                results.append(_check_intent(plan, value))
            elif key == "sentiment":
                results.append(_check_sentiment(plan, value))
            elif key == "min_actions":
                results.append(_check_min_actions(plan, value))
            elif key == "max_actions":
                results.append(_check_max_actions(plan, value))
            else:
                results.append(CheckResult(
                    name=f"unknown_assertion:{key}",
                    passed=False,
                    detail=f"no scorer registered for '{key}'",
                ))
        except Exception as exc:  # noqa: BLE001 — never let a check abort the run
            results.append(CheckResult(
                name=key,
                passed=False,
                detail=f"scorer raised: {exc}",
            ))

    return results


# --------------------------------------------------------------------------- #
# Individual checks. Each one returns exactly one CheckResult.
# --------------------------------------------------------------------------- #


def _departments(plan: Any) -> list[str]:
    """Derive the set of dispatched departments by inverting the agent display
    name on each AgentEvent. The Plan model doesn't expose the
    DepartmentAction list directly — agent fan-out only leaves traces in
    plan.events (display name) and plan.tool_calls (tool args). We use
    plan.events because every dispatched agent emits at least one event.
    Returns lowercased dept codes, deduped, in first-seen order."""
    seen: list[str] = []
    for ev in getattr(plan, "events", []) or []:
        agent_name = (getattr(ev, "agent", "") or "").strip().lower()
        if not agent_name or agent_name in _NON_AGENT_DISPLAY:
            continue
        dept = _DISPLAY_TO_DEPT.get(agent_name, agent_name)
        if dept not in seen:
            seen.append(dept)
    return seen


def _priorities(plan: Any) -> list[str]:
    """Plan exposes a single top-level `priority` (str). We return it as a
    one-element list so the at_most/at_least checks don't need to know
    whether actions are exposed individually or rolled up."""
    p = getattr(plan, "priority", None)
    if p is None:
        return []
    return [str(getattr(p, "value", p)).lower()]


def _check_agent_includes(plan, value) -> CheckResult:
    expected = [v.lower() for v in (value or [])]
    actual = [d.lower() for d in _departments(plan)]
    missing = [e for e in expected if e not in actual]
    return CheckResult(
        name="agent_includes",
        passed=not missing,
        detail=f"missing={missing} actual={actual}" if missing else f"actual={actual}",
    )


def _check_agent_excludes(plan, value) -> CheckResult:
    forbidden = [v.lower() for v in (value or [])]
    actual = [d.lower() for d in _departments(plan)]
    bad = [f for f in forbidden if f in actual]
    return CheckResult(
        name="agent_excludes",
        passed=not bad,
        detail=f"unexpected={bad} actual={actual}" if bad else f"actual={actual}",
    )


def _check_priority_at_most(plan, value) -> CheckResult:
    cap = _PRIORITY_RANK.get(str(value).lower())
    if cap is None:
        return CheckResult("priority_at_most", False, f"unknown priority: {value}")
    actual = _priorities(plan)
    # No priority on plan = vacuously satisfies 'at most' — that matches the
    # safety-side asymmetry: missing data shouldn't trip ceilings.
    if not actual:
        return CheckResult(f"priority_at_most:{value}", True, "no priority on plan")
    p = actual[0]
    return CheckResult(
        name=f"priority_at_most:{value}",
        passed=_PRIORITY_RANK.get(p, 99) <= cap,
        detail=f"actual={p}",
    )


def _check_priority_at_least(plan, value) -> CheckResult:
    floor = _PRIORITY_RANK.get(str(value).lower())
    if floor is None:
        return CheckResult("priority_at_least", False, f"unknown priority: {value}")
    actual = _priorities(plan)
    if not actual:
        return CheckResult(f"priority_at_least:{value}", False, "no priority on plan")
    p = actual[0]
    return CheckResult(
        name=f"priority_at_least:{value}",
        passed=_PRIORITY_RANK.get(p, -1) >= floor,
        detail=f"actual={p}",
    )


def _check_emergency(plan, value) -> CheckResult:
    """Plan has a top-level `emergency: bool`. Trust it. We also OR in
    'priority is urgent/emergency' as a backup so a plan that flags the
    top-level priority but forgets to set the bool still scores correctly."""
    flag = bool(getattr(plan, "emergency", False))
    pri = (getattr(plan, "priority", "") or "").lower()
    pri = getattr(pri, "value", pri) if not isinstance(pri, str) else pri
    actual = flag or pri in {"urgent", "emergency"}
    expected = bool(value)
    return CheckResult(
        name=f"emergency:{expected}",
        passed=actual == expected,
        detail=f"emergency_flag={flag} priority={pri}",
    )


def _check_reply_locale(plan, value) -> CheckResult:
    reply = getattr(plan, "guest_reply", None)
    if reply is None:
        return CheckResult("reply_locale", False, "no guest_reply")
    actual = getattr(reply, "locale", None)
    return CheckResult(
        name=f"reply_locale:{value}",
        passed=str(actual).lower() == str(value).lower(),
        detail=f"actual={actual}",
    )


def _check_reply_in_language(plan, value) -> CheckResult:
    reply = getattr(plan, "guest_reply", None)
    if reply is None:
        return CheckResult("reply_in_language", False, "no guest_reply")
    if not _HAS_LANGDETECT:
        return CheckResult(
            "reply_in_language", False,
            "langdetect not installed (pip install langdetect)",
        )
    msg = (getattr(reply, "message", "") or "").strip()
    if not msg:
        return CheckResult("reply_in_language", False, "empty message")
    try:
        detected = detect(msg)
    except Exception as exc:  # noqa: BLE001
        return CheckResult("reply_in_language", False, f"detect failed: {exc}")
    expected = str(value).lower()
    # langdetect returns 2-letter codes — normalise expected the same way.
    expected_short = expected.split("-")[0]
    return CheckResult(
        name=f"reply_in_language:{value}",
        passed=detected == expected_short,
        detail=f"detected={detected} message={msg!r}",
    )


def _check_tool_called(plan, value) -> CheckResult:
    expected = str(value)
    updates = getattr(plan, "memory_updates", []) or []
    kinds = [getattr(u, "kind", None) or getattr(u, "type", None) for u in updates]
    return CheckResult(
        name=f"tool_called:{expected}",
        passed=expected in [str(k) for k in kinds],
        detail=f"actual={kinds}",
    )


def _check_reply_contains(plan, value) -> CheckResult:
    needles = value if isinstance(value, list) else [value]
    reply = getattr(plan, "guest_reply", None)
    msg = (getattr(reply, "message", "") or "").lower() if reply else ""
    missing = [n for n in needles if str(n).lower() not in msg]
    return CheckResult(
        name="reply_contains",
        passed=not missing,
        detail=f"missing={missing}" if missing else f"message={msg!r}",
    )


def _check_reply_excludes(plan, value) -> CheckResult:
    needles = value if isinstance(value, list) else [value]
    reply = getattr(plan, "guest_reply", None)
    msg = (getattr(reply, "message", "") or "").lower() if reply else ""
    bad = [n for n in needles if str(n).lower() in msg]
    return CheckResult(
        name="reply_excludes",
        passed=not bad,
        detail=f"unexpected={bad}" if bad else "ok",
    )


def _check_intent(plan, value) -> CheckResult:
    actual = getattr(plan, "intent", None)
    return CheckResult(
        name=f"intent:{value}",
        passed=str(actual) == str(value),
        detail=f"actual={actual}",
    )


def _check_sentiment(plan, value) -> CheckResult:
    actual = getattr(plan, "sentiment", None)
    return CheckResult(
        name=f"sentiment:{value}",
        passed=str(actual) == str(value),
        detail=f"actual={actual}",
    )


def _check_min_actions(plan, value) -> CheckResult:
    """`actions` here means distinct dispatched departments — the same
    notion of 'who got told to do something' the other checks use."""
    n = int(value)
    depts = _departments(plan)
    return CheckResult(
        name=f"min_actions:{n}",
        passed=len(depts) >= n,
        detail=f"depts={depts}",
    )


def _check_max_actions(plan, value) -> CheckResult:
    n = int(value)
    depts = _departments(plan)
    return CheckResult(
        name=f"max_actions:{n}",
        passed=len(depts) <= n,
        detail=f"depts={depts}",
    )


@dataclass
class CaseResult:
    """Aggregated results for one fixture case (which may have multiple events)."""
    fixture: str
    case_id: str
    description: str
    checks: list[CheckResult] = field(default_factory=list)
    error: str | None = None  # populated if the orchestrator itself raised

    @property
    def passed(self) -> bool:
        return self.error is None and all(c.passed for c in self.checks)

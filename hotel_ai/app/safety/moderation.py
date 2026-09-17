"""Content moderation pipeline.

Primary path: optional external API (OpenAI Moderation) when
MODERATION_API_KEY is set. Fallback: deterministic regex (abuse patterns).
Never blocks the request path on network failure — fails open to regex.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.utils.logging import get_logger

log = get_logger(__name__)

_ABUSE = re.compile(
    r"("
    r"\bf[\W_]*u[\W_]*c[\W_]*k(?:ing|er|ed|s)?\b"
    r"|\bkill\s+(?:you|yourself|myself)\b"
    r"|\bi\s*will\s*(?:hurt|kill|hit)\b"
    r"|\bpiece\s+of\s+(?:shit|trash)\b"
    r"|\bshut\s+up\b"
    r"|\byou(?:\s+\w+){0,3}\s+(?:idiot|moron|stupid|asshole)\b"
    r"|\b(?:rape|molest)\b"
    r")",
    re.I,
)


@dataclass(frozen=True)
class ModerationResult:
    flagged: bool
    categories: list[str]
    source: str  # "regex" | "openai" | "none"
    scores: dict[str, float]


def looks_abusive(text: str) -> bool:
    return bool(_ABUSE.search(text or ""))


def moderate_regex(text: str) -> ModerationResult:
    flagged = looks_abusive(text)
    cats = ["harassment"] if flagged else []
    return ModerationResult(
        flagged=flagged,
        categories=cats,
        source="regex",
        scores={"harassment": 1.0 if flagged else 0.0},
    )


def moderate_openai(text: str, api_key: str) -> ModerationResult | None:
    """Call OpenAI Moderation API. Returns None on any failure."""
    if not api_key or not (text or "").strip():
        return None
    try:
        import httpx

        resp = httpx.post(
            "https://api.openai.com/v1/moderations",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"input": text[:5000]},
            timeout=3.0,
        )
        resp.raise_for_status()
        data = resp.json()
        result = (data.get("results") or [{}])[0]
        flagged = bool(result.get("flagged"))
        cats_raw: dict[str, Any] = result.get("categories") or {}
        scores_raw: dict[str, Any] = result.get("category_scores") or {}
        categories = [k for k, v in cats_raw.items() if v]
        scores = {k: float(v) for k, v in scores_raw.items()}
        return ModerationResult(
            flagged=flagged,
            categories=categories,
            source="openai",
            scores=scores,
        )
    except Exception as e:  # noqa: BLE001 — fail open to regex
        log.warning("moderation_api_failed", extra={"error": str(e)})
        return None


def moderate(text: str, api_key: str = "") -> ModerationResult:
    """Run moderation: external API when configured, else regex."""
    if api_key:
        remote = moderate_openai(text, api_key)
        if remote is not None:
            local = moderate_regex(text)
            if local.flagged and not remote.flagged:
                return ModerationResult(
                    flagged=True,
                    categories=sorted(set(remote.categories + local.categories)),
                    source="openai+regex",
                    scores={**remote.scores, **local.scores},
                )
            return remote
    return moderate_regex(text)

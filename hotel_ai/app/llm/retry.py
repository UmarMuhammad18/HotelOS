"""
Content-level retry wrapper for LLMClient.

Why this exists
---------------
The provider clients (GroqLLM, GeminiLLM, AnthropicLLM) already retry on
transport errors via tenacity on `_complete`. But classification calls have
a *second* failure mode that doesn't trigger transport retries: the call
returns 200 OK, but the body is malformed JSON, missing the `actions` key,
or has an empty `actions` list.

With smaller / faster models (e.g. `llama-3.1-8b-instant` on Groq) this
happens often enough that ~5–10% of eval runs see one or two cases drop
into the orchestrator's `llm_classify_failed` fallback path. That fallback
sends the request to FRONT_DESK with priority=normal — so a "smoke in the
bathroom" emergency can silently get demoted to "guest request needs
triage".

`RetryingLLMClient` wraps any LLMClient and retries `classify_json` when
the *content* is bad. Transport retries are still handled inside the
provider, so we don't double-stack on network flakes — this only adds
extra attempts when the model returns something we can't use.

Design notes
------------
- `reply_text` is NOT wrapped: provider transport retry is sufficient and
  retrying free-form text would risk double-sending translations.
- We retry on `JSONDecodeError`, `ValueError`, and the explicit
  "missing/empty actions" shape failure. We do NOT retry on auth errors,
  config errors, or other non-content exceptions — those bubble up.
- We bound retries (default: 2 attempts after the first call → 3 total)
  with quick exponential backoff, so a real outage degrades fast.
- After exhausting retries we re-raise so the orchestrator's existing
  fallback (`_classify` → FRONT_DESK normal) still runs.

Usage
-----
    base = GroqLLM()
    llm = RetryingLLMClient(base)            # 1 + 2 retries = 3 attempts max
    llm = RetryingLLMClient(base, attempts=4) # 1 + 3 retries = 4 attempts max
"""

from __future__ import annotations

import json
import time
from typing import Any

from app.utils.logging import get_logger

log = get_logger(__name__)


# Exceptions that indicate a bad-content response (worth retrying).
# Transport / SDK-level exceptions are NOT in this set — those are already
# handled by tenacity inside each provider's `_complete`.
_CONTENT_RETRYABLE: tuple[type[BaseException], ...] = (
    json.JSONDecodeError,
    ValueError,
)


def _is_well_formed_classify_result(data: Any) -> bool:
    """A classify result is usable iff it's a dict with non-empty `actions`."""
    if not isinstance(data, dict):
        return False
    actions = data.get("actions")
    return isinstance(actions, list) and len(actions) > 0


class RetryingLLMClient:
    """Retry `classify_json` on content-level failures.

    Parameters
    ----------
    inner:
        The underlying LLM client (GroqLLM, GeminiLLM, AnthropicLLM, FakeLLM).
    attempts:
        Total number of attempts (>= 1). 1 = no retry. Default 3 means
        the first call plus 2 retries.
    backoff_seconds:
        Base sleep between attempts; doubles each retry. Default 0.5s
        gives 0.5s, 1.0s, 2.0s — fast enough that real outages degrade
        quickly, slow enough that we don't hammer a recovering provider.
    """

    def __init__(
        self,
        inner: Any,
        attempts: int = 3,
        backoff_seconds: float = 0.5,
    ) -> None:
        if attempts < 1:
            raise ValueError("attempts must be >= 1")
        if backoff_seconds < 0:
            raise ValueError("backoff_seconds must be >= 0")
        self._inner = inner
        self._attempts = attempts
        self._backoff = backoff_seconds

    # ----- LLMClient protocol --------------------------------------------------

    def classify_json(self, system: str, user: str) -> dict:
        last_err: BaseException | None = None

        for attempt in range(1, self._attempts + 1):
            try:
                data = self._inner.classify_json(system=system, user=user)
            except _CONTENT_RETRYABLE as e:
                last_err = e
                log.warning(
                    "llm_classify_retry_parse",
                    extra={"attempt": attempt, "max": self._attempts, "error": str(e)},
                )
            else:
                if _is_well_formed_classify_result(data):
                    if attempt > 1:
                        log.info(
                            "llm_classify_retry_succeeded",
                            extra={"attempt": attempt},
                        )
                    return data
                last_err = ValueError(
                    f"classify result missing/empty 'actions' "
                    f"(keys={list(data.keys()) if isinstance(data, dict) else type(data).__name__})"
                )
                log.warning(
                    "llm_classify_retry_shape",
                    extra={"attempt": attempt, "max": self._attempts, "error": str(last_err)},
                )

            if attempt < self._attempts and self._backoff > 0:
                time.sleep(self._backoff * (2 ** (attempt - 1)))

        # Exhausted retries — bubble up so orchestrator fallback runs.
        assert last_err is not None  # for type checkers
        log.error(
            "llm_classify_retry_exhausted",
            extra={"attempts": self._attempts, "error": str(last_err)},
        )
        raise last_err

    def reply_text(self, system: str, user: str) -> str:
        # No content-level retry for reply_text — transport retries inside
        # the provider are sufficient, and retrying free text could cause
        # double-translation.
        return self._inner.reply_text(system=system, user=user)

    def ping(self) -> bool:
        """Passthrough to the underlying client's healthcheck.

        We deliberately don't retry here — the `/v1/health/deep` route
        wants a fast yes/no, not "we eventually got through". A flaky
        provider should fail the deep healthcheck; that's the signal.
        """
        ping = getattr(self._inner, "ping", None)
        if callable(ping):
            return bool(ping())
        # Older / custom clients may not implement ping. Treat absence
        # as "healthy" rather than crashing the healthcheck route.
        return True

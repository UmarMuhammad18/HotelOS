"""
Thin LLM client wrapper.

Why wrap the SDK
----------------
1. We want to swap providers or models without touching agents.
2. We want a single place to enforce timeouts, retries, and JSON parsing.
3. We want a `FakeLLM` for tests so we don't hit the network.

Agents call `LLMClient.classify_json(...)` or `LLMClient.reply_text(...)`;
they never see raw SDK objects.

Supported providers
-------------------
- "groq"     — Groq-hosted Llama/Mixtral (free tier, no card, global).
- "gemini"   — Google Gemini via google-generativeai (free tier, region-limited).
- "anthropic"— Anthropic Claude via anthropic SDK.
- "fake"     — Deterministic stub for tests / offline dev.

Selection precedence (when LLM_PROVIDER is unset):
    GROQ_API_KEY       → GroqLLM
    GEMINI_API_KEY     → GeminiLLM
    ANTHROPIC_API_KEY  → AnthropicLLM
    nothing set        → FakeLLM
"""

from __future__ import annotations

import json
from typing import Protocol

from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.utils.logging import get_logger
from app.llm.retry import RetryingLLMClient

log = get_logger(__name__)

# Default model per provider. Override via LLM_MODEL env var.
# - Groq:    llama-3.1-8b-instant is fast, cheap, and plenty for classification.
#            For better reasoning try LLM_MODEL=llama-3.3-70b-versatile.
# - Gemini:  gemini-2.0-flash is the current GA flash model.
# - Anthropic: claude-sonnet-4-6 is our quality target.
_DEFAULT_MODELS = {
    "groq": "llama-3.1-8b-instant",
    "gemini": "gemini-2.0-flash",
    "anthropic": "claude-sonnet-4-6",
}


class LLMClient(Protocol):
    def classify_json(self, system: str, user: str) -> dict: ...
    def reply_text(self, system: str, user: str) -> str: ...


def _extract_json(raw: str) -> dict:
    """Best-effort JSON extraction — tolerate prose around the object."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end != -1:
            return json.loads(raw[start : end + 1])
        log.warning("llm_json_parse_failed", extra={"raw": raw[:500]})
        raise


class AnthropicLLM:
    """Production LLM client. Uses the Anthropic Messages API."""

    def __init__(self) -> None:
        # Import inside to keep anthropic optional at runtime.
        from anthropic import Anthropic

        s = get_settings()
        self._client = Anthropic(api_key=s.anthropic_api_key)
        self._model = s.llm_model or _DEFAULT_MODELS["anthropic"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    def _complete(self, system: str, user: str, max_tokens: int = 1024) -> str:
        msg = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in msg.content if block.type == "text")

    def classify_json(self, system: str, user: str) -> dict:
        return _extract_json(self._complete(system=system, user=user))

    def reply_text(self, system: str, user: str) -> str:
        return self._complete(system=system, user=user)


class GeminiLLM:
    """
    Production LLM client using Google Gemini.

    Uses the free tier of `gemini-1.5-flash` by default — generous daily
    quota, no credit card required. Sign up at https://aistudio.google.com/apikey.

    JSON mode is requested via `response_mime_type="application/json"` so
    Gemini returns strict JSON for `classify_json`.
    """

    def __init__(self) -> None:
        import google.generativeai as genai

        s = get_settings()
        genai.configure(api_key=s.gemini_api_key)
        self._genai = genai
        self._model = s.llm_model or _DEFAULT_MODELS["gemini"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    def _complete(self, system: str, user: str, json_mode: bool = False) -> str:
        generation_config: dict = {}
        if json_mode:
            generation_config["response_mime_type"] = "application/json"
        model = self._genai.GenerativeModel(
            model_name=self._model,
            system_instruction=system,
            generation_config=generation_config or None,
        )
        response = model.generate_content(user)
        # `response.text` raises if the response was blocked — let retry handle it.
        return response.text or ""

    def classify_json(self, system: str, user: str) -> dict:
        raw = self._complete(system=system, user=user, json_mode=True)
        return _extract_json(raw)

    def reply_text(self, system: str, user: str) -> str:
        return self._complete(system=system, user=user, json_mode=False)


class GroqLLM:
    """
    Production LLM client using Groq's hosted Llama/Mixtral models.

    Why Groq
    --------
    - Free tier is genuinely free (no card) and globally available.
    - Inference is fast (<1s for 8b models) because Groq runs custom silicon.
    - OpenAI-compatible chat-completions API — swap in with minimal ceremony.

    Sign up at https://console.groq.com/keys for an API key.
    """

    def __init__(self) -> None:
        from groq import Groq

        s = get_settings()
        self._client = Groq(api_key=s.groq_api_key)
        self._model = s.llm_model or _DEFAULT_MODELS["groq"]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=8))
    def _complete(
        self,
        system: str,
        user: str,
        json_mode: bool = False,
        max_tokens: int = 1024,
    ) -> str:
        kwargs: dict = {
            "model": self._model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        completion = self._client.chat.completions.create(**kwargs)
        return completion.choices[0].message.content or ""

    def classify_json(self, system: str, user: str) -> dict:
        raw = self._complete(system=system, user=user, json_mode=True)
        return _extract_json(raw)

    def reply_text(self, system: str, user: str) -> str:
        return self._complete(system=system, user=user, json_mode=False)


class FakeLLM:
    """Deterministic stub used in tests and local dev without API keys."""

    def __init__(self, canned: dict | None = None, text: str = "ok") -> None:
        self._canned = canned or {}
        self._text = text

    def classify_json(self, system: str, user: str) -> dict:  # noqa: ARG002
        return self._canned

    def reply_text(self, system: str, user: str) -> str:  # noqa: ARG002
        return self._text


def build_llm() -> LLMClient:
    """
    Factory — returns a provider based on LLM_PROVIDER, or auto-detects
    from which API key is set. Falls back to FakeLLM when nothing is
    configured (useful for offline dev and tests).
    """
    s = get_settings()
    provider = (s.llm_provider or "").strip().lower()

    # Explicit provider override.
    if provider == "groq":
        if not s.groq_api_key:
            log.warning("llm_provider_groq_but_no_key_using_fake")
            return FakeLLM()
        return RetryingLLMClient(GroqLLM())
    if provider == "gemini":
        if not s.gemini_api_key:
            log.warning("llm_provider_gemini_but_no_key_using_fake")
            return FakeLLM()
        return RetryingLLMClient(GeminiLLM())
    if provider == "anthropic":
        if not s.anthropic_api_key:
            log.warning("llm_provider_anthropic_but_no_key_using_fake")
            return FakeLLM()
        return RetryingLLMClient(AnthropicLLM())
    if provider == "fake":
        return FakeLLM()

    # Auto-detect: prefer Groq (no regional restrictions), then Gemini,
    # then Anthropic, then Fake.
    if s.groq_api_key:
        log.info("llm_autoselect_groq")
        return RetryingLLMClient(GroqLLM())
    if s.gemini_api_key:
        log.info("llm_autoselect_gemini")
        return RetryingLLMClient(GeminiLLM())
    if s.anthropic_api_key:
        log.info("llm_autoselect_anthropic")
        return RetryingLLMClient(AnthropicLLM())
    log.warning("no_llm_key_using_fake_llm")
    return FakeLLM()

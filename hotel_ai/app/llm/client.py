"""
Thin LLM client wrapper.

Why wrap the SDK
----------------
1. Swap providers or models without touching agents.
2. Single place to enforce timeouts, retries, JSON parsing.
3. `FakeLLM` for tests so we don't hit the network.

Agents call `LLMClient.classify_json(...)` or `LLMClient.reply_text(...)`;
they never see raw SDK objects.

Concurrency model
-----------------
The protocol is intentionally synchronous. Routes dispatch the
orchestrator (which calls these clients) via `asyncio.to_thread` so the
event loop is never blocked by an LLM round-trip. This keeps every
agent, the orchestrator, and the test suite simple — only the routes
layer cares about async concerns.

Health-check
------------
Every client implements `ping()`, used by `/v1/health/deep`. The ping
issues a tiny prompt and returns True if the provider responds without
error. Use this in a load balancer healthcheck if you want to fail
over when the LLM goes down.
"""

from __future__ import annotations

import copy
import json
from typing import Protocol

from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings
from app.llm.retry import RetryingLLMClient
from app.utils.logging import get_logger

log = get_logger(__name__)


# Default model per provider. Override via LLM_MODEL env var.
# - Groq: 70b is more reliable for strict-JSON than 8b. Both free-tier.
# - Gemini: 2.0-flash is the current GA flash model.
# - Anthropic: Claude Sonnet 4.6 is our quality target.
_DEFAULT_MODELS = {
    "groq": "llama-3.3-70b-versatile",
    "gemini": "gemini-2.0-flash",
    "anthropic": "claude-sonnet-4-6",
}


class LLMClient(Protocol):
    def classify_json(self, system: str, user: str) -> dict: ...
    def reply_text(self, system: str, user: str) -> str: ...
    def ping(self) -> bool: ...


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


# --- Anthropic ---------------------------------------------------------------


class AnthropicLLM:
    def __init__(self) -> None:
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

    def ping(self) -> bool:
        try:
            self._complete(system="You are a healthcheck.", user="ping", max_tokens=8)
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("anthropic_ping_failed", extra={"error": str(e)})
            return False


# --- Gemini ------------------------------------------------------------------


class GeminiLLM:
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
        return response.text or ""

    def classify_json(self, system: str, user: str) -> dict:
        raw = self._complete(system=system, user=user, json_mode=True)
        return _extract_json(raw)

    def reply_text(self, system: str, user: str) -> str:
        return self._complete(system=system, user=user, json_mode=False)

    def ping(self) -> bool:
        try:
            self._complete(system="You are a healthcheck.", user="ping")
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("gemini_ping_failed", extra={"error": str(e)})
            return False


# --- Groq --------------------------------------------------------------------


class GroqLLM:
    """Groq-hosted Llama. Free-tier, fast, OpenAI-compatible."""

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

    def ping(self) -> bool:
        try:
            self._complete(
                system="You are a healthcheck.",
                user="ping",
                max_tokens=8,
            )
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("groq_ping_failed", extra={"error": str(e)})
            return False


# --- FakeLLM (tests + offline) ----------------------------------------------


class FakeLLM:
    """Deterministic stub for tests / local dev without API keys.

    Returns *deep copies* of canned responses so test fixtures aren't
    mutated through repeated calls.
    """

    def __init__(self, canned: dict | None = None, text: str = "ok") -> None:
        self._canned = canned or {}
        self._text = text

    def classify_json(self, system: str, user: str) -> dict:  # noqa: ARG002
        return copy.deepcopy(self._canned)

    def reply_text(self, system: str, user: str) -> str:  # noqa: ARG002
        return self._text

    def ping(self) -> bool:
        return True


# --- factory -----------------------------------------------------------------


def build_llm() -> LLMClient:
    s = get_settings()
    provider = (s.llm_provider or "").strip().lower()

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

    # Auto-detect.
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

"""
Localization helper used by all department agents.

We translate guest-facing replies inside each agent rather than running a
second translation pass in the orchestrator. The single-pass design:
  - cuts LLM cost in ~half for non-English guests,
  - removes a class of failure where a translation succeeds at one layer
    and fails at another, leaving the UI claiming a language it didn't
    actually deliver,
  - keeps each agent in charge of its own messaging tone.

When translation fails or the target is empty/English-ish, we return the
original English text and force `locale="en"` on the GuestReply so
downstream services see the same locale they're sending.
"""

from __future__ import annotations

from app.llm.client import LLMClient
from app.models import GuestReply
from app.utils.logging import get_logger

log = get_logger(__name__)


_ENGLISH_ALIASES = {"en", "en-us", "en-gb", "en-au", "eng", ""}

_LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pt-br": "Brazilian Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "ru": "Russian",
    "ar": "Arabic",
    "zh": "Chinese (Simplified)",
    "zh-cn": "Chinese (Simplified)",
    "zh-tw": "Chinese (Traditional)",
    "ja": "Japanese",
    "ko": "Korean",
    "hi": "Hindi",
}


_TRANSLATE_SYSTEM = """\
You are a translation layer for short guest-facing hotel replies.

Rules:
- Translate ONLY into the requested target language.
- Preserve room numbers, times, and named services exactly.
- Keep the tone polite and professional.
- Keep it to 1-3 sentences — never add a greeting, signature, or explanation.
- Output ONLY the translated text. No quotes, no prefaces, no language tags.
"""


def localized_reply(
    llm: LLMClient,
    english_message: str,
    target_language: str | None,
) -> GuestReply:
    """Build a GuestReply in the guest's preferred language.

    Falls back to English (with `locale="en"`) for empty / English /
    failed-translation cases so the UI never claims a language we
    couldn't deliver.
    """
    if not target_language:
        return GuestReply(message=english_message, locale="en")

    target = target_language.strip().lower()
    if target in _ENGLISH_ALIASES:
        return GuestReply(message=english_message, locale="en")

    language_name = _LANGUAGE_NAMES.get(target, target_language)

    try:
        translated = llm.reply_text(
            system=_TRANSLATE_SYSTEM,
            user=(
                f"Target language: {language_name}\n\n"
                f"Reply to translate:\n{english_message}"
            ),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "translate_failed",
            extra={"target": target, "error": str(exc)},
        )
        return GuestReply(message=english_message, locale="en")

    translated = (translated or "").strip()
    if not translated:
        log.warning("translate_empty", extra={"target": target})
        return GuestReply(message=english_message, locale="en")

    return GuestReply(message=translated, locale=target)

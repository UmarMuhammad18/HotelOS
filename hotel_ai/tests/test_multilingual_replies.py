"""
Phase 2c — multilingual guest reply tests.

Pins the behaviour that when `GuestProfile.language` is non-English, the
orchestrator routes the final `guest_reply.message` through the LLM's
`reply_text` translator and sets `plan.guest_reply.locale` accordingly.

The tests do NOT take a dependency on a real LLM — they use a small double
that records every `reply_text` invocation and returns canned output (or
raises). This keeps the tests deterministic and fast while still pinning
the orchestrator contract:

  * When the guest's language is English-ish, no translation call is made.
  * When it isn't, exactly one `reply_text` call is made, the user payload
    names the target language, and the resulting guest_reply carries both
    the translated text and the target locale.
  * When translation fails (exception or empty result), the reply falls
    back to the English template and `locale` stays "en" — we'd rather the
    guest get something real than silently claim a language we couldn't
    produce.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.agents.orchestrator import Orchestrator
from app.memory.guest_memory import GuestMemory
from app.memory.store import JSONFileStore
from app.models import (
    EventChannel,
    GuestProfile,
    HotelEvent,
    StayContext,
)


class TranslatingLLM:
    """LLM double: canned classification + recording translator."""

    def __init__(self, canned_classify: dict, translate_fn=None) -> None:
        self.canned_classify = canned_classify
        self.translate_fn = translate_fn  # (system, user) -> str | raises
        self.translate_calls: list[tuple[str, str]] = []

    def classify_json(self, system: str, user: str) -> dict:  # noqa: ARG002
        return self.canned_classify

    def reply_text(self, system: str, user: str) -> str:
        self.translate_calls.append((system, user))
        if self.translate_fn is None:
            # Empty default makes "unexpectedly called" failures obvious.
            return ""
        return self.translate_fn(system, user)


_CANNED_HOUSEKEEPING = {
    "actions": [{
        "department": "housekeeping",
        "summary": "Deliver extra towels",
        "details": "Guest asked for extra towels.",
        "priority": "normal",
        "requires_coordination_with": [],
    }],
    "intent": "amenity_request",
    "sentiment": "neutral",
}


def _build_orch(tmp_path, llm) -> Orchestrator:
    store = JSONFileStore(str(tmp_path / "mem.json"))
    memory = GuestMemory(store)
    return Orchestrator(llm=llm, memory=memory)


def _stay(language: str | None = "en") -> StayContext:
    return StayContext(
        guest=GuestProfile(
            guest_id="g-x",
            full_name="Test Guest",
            language=language or "en",
        ),
        room_number="412",
        check_in=date(2026, 4, 23),
        check_out=date(2026, 4, 25),
        reservation_id="r-x",
    )


def _event(text: str = "Extra towels please") -> HotelEvent:
    return HotelEvent(
        channel=EventChannel.GUEST_CHAT,
        reservation_id="r-x",
        room_number="412",
        guest_id="g-x",
        text=text,
    )


# --------------------------------------------------------------------------- #
# Happy path — English-speaking guest: never invoke the translator.
# --------------------------------------------------------------------------- #


def test_english_guest_skips_translator(tmp_path):
    llm = TranslatingLLM(_CANNED_HOUSEKEEPING)
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(), _stay("en"))

    # Translator MUST NOT be called for English speakers.
    assert llm.translate_calls == []
    assert plan.guest_reply is not None
    assert plan.guest_reply.locale == "en"
    # The original English message survives untouched.
    assert plan.guest_reply.message


@pytest.mark.parametrize("code", ["en", "EN", "en-US", "en-GB"])
def test_english_aliases_skip_translator(tmp_path, code):
    llm = TranslatingLLM(_CANNED_HOUSEKEEPING)
    orch = _build_orch(tmp_path, llm)
    orch.build_plan(_event(), _stay(code))
    assert llm.translate_calls == []


# --------------------------------------------------------------------------- #
# Translation path — non-English language triggers exactly one reply_text call.
# --------------------------------------------------------------------------- #


def test_spanish_guest_gets_translated_reply(tmp_path):
    def fake_translate(system, user):  # noqa: ARG001
        return "Se han enviado toallas adicionales a la habitación 412."

    llm = TranslatingLLM(_CANNED_HOUSEKEEPING, translate_fn=fake_translate)
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(), _stay("es"))

    # Exactly one translation call.
    assert len(llm.translate_calls) == 1
    _, user_payload = llm.translate_calls[0]
    # The payload names the target language explicitly so the LLM doesn't
    # have to guess from a 2-letter code.
    assert "Spanish" in user_payload
    assert "Target language" in user_payload

    # Reply now carries the translated text + the guest's locale code.
    assert plan.guest_reply is not None
    assert plan.guest_reply.locale == "es"
    assert "toallas" in plan.guest_reply.message


def test_known_language_codes_use_human_name(tmp_path):
    """Mapped codes should give the LLM a readable language name, not a code."""
    captured: dict = {}

    def capture(system, user):  # noqa: ARG001
        captured["user"] = user
        return "Nous avons envoyé des serviettes supplémentaires à la chambre 412."

    llm = TranslatingLLM(_CANNED_HOUSEKEEPING, translate_fn=capture)
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(), _stay("fr"))

    assert "French" in captured["user"]
    assert plan.guest_reply is not None
    assert plan.guest_reply.locale == "fr"


def test_unknown_language_code_still_attempts_translation(tmp_path):
    """A code missing from our tiny map is still passed through — Groq
    handles most major languages fine even without us naming them."""
    llm = TranslatingLLM(
        _CANNED_HOUSEKEEPING,
        translate_fn=lambda s, u: "Kiitos, pyynne on lähetetty.",
    )
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(), _stay("fi"))

    assert len(llm.translate_calls) == 1
    assert plan.guest_reply is not None
    assert plan.guest_reply.locale == "fi"
    assert "Kiitos" in plan.guest_reply.message


# --------------------------------------------------------------------------- #
# Degradation — translation failures must NOT strand the guest.
# --------------------------------------------------------------------------- #


def test_translator_exception_falls_back_to_english(tmp_path):
    def boom(system, user):  # noqa: ARG001
        raise RuntimeError("translator down")

    llm = TranslatingLLM(_CANNED_HOUSEKEEPING, translate_fn=boom)
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(), _stay("de"))

    # Attempt was made, but we degrade to the English original.
    assert len(llm.translate_calls) == 1
    assert plan.guest_reply is not None
    # Locale stays "en" — the UI should not claim German if we couldn't deliver.
    assert plan.guest_reply.locale == "en"
    assert plan.guest_reply.message  # non-empty English fallback


def test_empty_translation_falls_back_to_english(tmp_path):
    """A whitespace-only translation is indistinguishable from failure."""
    llm = TranslatingLLM(
        _CANNED_HOUSEKEEPING,
        translate_fn=lambda s, u: "   ",
    )
    orch = _build_orch(tmp_path, llm)
    plan = orch.build_plan(_event(), _stay("it"))

    assert len(llm.translate_calls) == 1
    assert plan.guest_reply is not None
    assert plan.guest_reply.locale == "en"

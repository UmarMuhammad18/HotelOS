"""Tests for the agent-layer translation pipeline."""

from __future__ import annotations

import pytest

from app.agents.localize import localized_reply


class _SpyLLM:
    def __init__(self, reply: str = "ok", raise_on_reply: BaseException | None = None):
        self.reply = reply
        self.raise_on_reply = raise_on_reply
        self.reply_calls: list[tuple[str, str]] = []

    def classify_json(self, system, user):  # noqa: ARG002
        raise AssertionError("classify_json should not be called by translate path")

    def reply_text(self, system: str, user: str) -> str:
        self.reply_calls.append((system, user))
        if self.raise_on_reply is not None:
            raise self.raise_on_reply
        return self.reply

    def ping(self):
        return True


def test_english_target_does_not_call_llm():
    llm = _SpyLLM()
    out = localized_reply(llm, "Your towels are on the way.", "en")
    assert out.message == "Your towels are on the way."
    assert out.locale == "en"
    assert llm.reply_calls == []


def test_empty_target_does_not_call_llm():
    llm = _SpyLLM()
    out = localized_reply(llm, "Your towels are on the way.", "")
    assert out.locale == "en"
    assert llm.reply_calls == []


def test_none_target_does_not_call_llm():
    llm = _SpyLLM()
    out = localized_reply(llm, "Your towels are on the way.", None)
    assert out.locale == "en"
    assert llm.reply_calls == []


@pytest.mark.parametrize(
    "code,language_name",
    [
        ("es", "Spanish"),
        ("fr", "French"),
        ("ja", "Japanese"),
        ("pt-br", "Brazilian Portuguese"),
    ],
)
def test_non_english_target_calls_llm_once(code, language_name):
    llm = _SpyLLM(reply="Sus toallas están en camino.")
    out = localized_reply(llm, "Your towels are on the way.", code)
    assert len(llm.reply_calls) == 1
    _, user = llm.reply_calls[0]
    assert language_name in user
    assert out.message == "Sus toallas están en camino."
    assert out.locale == code.lower()


def test_unknown_target_passed_through_verbatim():
    llm = _SpyLLM(reply="Tasak hîn ne li ser rê ne.")
    out = localized_reply(llm, "Your towels are on the way.", "ku")
    assert len(llm.reply_calls) == 1
    _, user = llm.reply_calls[0]
    assert "ku" in user
    assert out.locale == "ku"


def test_llm_failure_returns_english_with_en_locale():
    llm = _SpyLLM(raise_on_reply=RuntimeError("provider down"))
    out = localized_reply(llm, "Your towels are on the way.", "fr")
    assert out.message == "Your towels are on the way."
    assert out.locale == "en"


def test_llm_empty_response_returns_english_with_en_locale():
    llm = _SpyLLM(reply="   \n  ")
    out = localized_reply(llm, "Your towels are on the way.", "fr")
    assert out.locale == "en"


def test_translation_strips_whitespace():
    llm = _SpyLLM(reply="\n  Sus toallas están en camino.  \n")
    out = localized_reply(llm, "Your towels are on the way.", "es")
    assert out.message == "Sus toallas están en camino."
    assert out.locale == "es"

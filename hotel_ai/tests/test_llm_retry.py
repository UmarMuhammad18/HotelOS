"""
Tests for RetryingLLMClient — content-level retry on classify_json.

Covers:
- Succeeds on first try (no retry)
- Retries on JSONDecodeError and returns the next good result
- Retries on missing/empty `actions` and returns the next good result
- Bubbles up after exhausting retries
- Does NOT retry on attempts=1
- Does NOT wrap reply_text (passthrough)
- Does NOT retry on non-content exceptions (e.g. RuntimeError)
"""

from __future__ import annotations

import json

import pytest

from app.llm.retry import RetryingLLMClient


class _StubLLM:
    """Minimal LLM stub. `classify_responses` is a list — each element is
    either an exception (raised) or a value (returned). Calls advance the
    list; running off the end fails the test.
    """

    def __init__(self, classify_responses=None, reply_responses=None):
        self.classify_responses = list(classify_responses or [])
        self.reply_responses = list(reply_responses or [])
        self.classify_calls = 0
        self.reply_calls = 0

    def classify_json(self, system: str, user: str) -> dict:
        self.classify_calls += 1
        if not self.classify_responses:
            raise AssertionError("stub ran out of classify responses")
        nxt = self.classify_responses.pop(0)
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt

    def reply_text(self, system: str, user: str) -> str:
        self.reply_calls += 1
        if not self.reply_responses:
            raise AssertionError("stub ran out of reply responses")
        nxt = self.reply_responses.pop(0)
        if isinstance(nxt, BaseException):
            raise nxt
        return nxt


# --------------------------------------------------------------- happy paths --


def test_classify_json_returns_first_good_result_without_retry():
    good = {"actions": [{"department": "housekeeping"}], "intent": "x"}
    inner = _StubLLM(classify_responses=[good])
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.classify_json(system="s", user="u") == good
    assert inner.classify_calls == 1


def test_reply_text_is_passthrough_no_retry():
    inner = _StubLLM(reply_responses=["hello world"])
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.reply_text(system="s", user="u") == "hello world"
    assert inner.reply_calls == 1


# ---------------------------------------------------------- retry on content --


def test_classify_json_retries_on_json_decode_error():
    good = {"actions": [{"department": "front_desk"}]}
    inner = _StubLLM(
        classify_responses=[
            json.JSONDecodeError("boom", "doc", 0),
            good,
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.classify_json(system="s", user="u") == good
    assert inner.classify_calls == 2


def test_classify_json_retries_on_empty_actions():
    good = {"actions": [{"department": "maintenance"}]}
    inner = _StubLLM(
        classify_responses=[
            {"actions": [], "intent": "x"},  # empty
            good,
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.classify_json(system="s", user="u") == good
    assert inner.classify_calls == 2


def test_classify_json_retries_on_missing_actions_key():
    good = {"actions": [{"department": "security"}]}
    inner = _StubLLM(
        classify_responses=[
            {"intent": "x"},  # no actions key at all
            good,
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.classify_json(system="s", user="u") == good
    assert inner.classify_calls == 2


def test_classify_json_retries_on_non_dict_result():
    good = {"actions": [{"department": "concierge"}]}
    inner = _StubLLM(
        classify_responses=[
            ["not", "a", "dict"],  # wrong shape entirely
            good,
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.classify_json(system="s", user="u") == good
    assert inner.classify_calls == 2


def test_classify_json_retries_on_value_error():
    good = {"actions": [{"department": "front_desk"}]}
    inner = _StubLLM(
        classify_responses=[
            ValueError("malformed"),
            good,
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    assert llm.classify_json(system="s", user="u") == good
    assert inner.classify_calls == 2


# --------------------------------------------------------- exhaustion / limit --


def test_classify_json_exhausts_and_raises_last_error():
    inner = _StubLLM(
        classify_responses=[
            ValueError("first"),
            ValueError("second"),
            ValueError("third"),
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    with pytest.raises(ValueError, match="third"):
        llm.classify_json(system="s", user="u")
    assert inner.classify_calls == 3


def test_classify_json_attempts_one_means_no_retry():
    inner = _StubLLM(classify_responses=[ValueError("nope")])
    llm = RetryingLLMClient(inner, attempts=1, backoff_seconds=0)

    with pytest.raises(ValueError, match="nope"):
        llm.classify_json(system="s", user="u")
    assert inner.classify_calls == 1


# ---------------------------------------------------------- non-content errors --


def test_classify_json_does_not_retry_on_runtime_error():
    """RuntimeError isn't in the content-retryable set — should bubble up
    on the first attempt without consuming retries."""
    inner = _StubLLM(
        classify_responses=[
            RuntimeError("auth failed"),
            {"actions": [{"department": "front_desk"}]},  # would succeed if retried
        ]
    )
    llm = RetryingLLMClient(inner, attempts=3, backoff_seconds=0)

    with pytest.raises(RuntimeError, match="auth failed"):
        llm.classify_json(system="s", user="u")
    assert inner.classify_calls == 1  # crucial: did NOT retry


# ------------------------------------------------------------------ guards --


def test_attempts_must_be_at_least_one():
    inner = _StubLLM()
    with pytest.raises(ValueError, match="attempts"):
        RetryingLLMClient(inner, attempts=0)


def test_backoff_must_be_non_negative():
    inner = _StubLLM()
    with pytest.raises(ValueError, match="backoff"):
        RetryingLLMClient(inner, backoff_seconds=-1.0)

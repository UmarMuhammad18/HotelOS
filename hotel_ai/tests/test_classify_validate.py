"""Tests for LLM classify output normalisation."""

from __future__ import annotations

import pytest

from app.llm.validate import normalize_classify_result


def test_normalises_department_aliases():
    raw = {
        "actions": [
            {
                "department": "Front Desk",
                "summary": "Help with key",
                "details": "",
                "priority": "NORMAL",
                "requires_coordination_with": None,
            }
        ],
        "intent": "key_issue",
        "sentiment": "Neutral",
        "confidence": "0.8",
    }
    out = normalize_classify_result(raw)
    assert out["actions"][0]["department"] == "front_desk"
    assert out["actions"][0]["priority"] == "normal"
    assert out["actions"][0]["requires_coordination_with"] == []
    assert out["sentiment"] == "neutral"
    assert out["confidence"] == 0.8


def test_fnb_alias():
    raw = {
        "actions": [
            {
                "department": "F&B",
                "summary": "Replace order",
                "priority": "high",
                "requires_coordination_with": ["Guest Experience"],
            }
        ],
        "intent": "fnb_complaint",
        "sentiment": "angry",
        "confidence": 0.9,
    }
    out = normalize_classify_result(raw)
    assert out["actions"][0]["department"] == "food_beverage"
    assert out["actions"][0]["requires_coordination_with"] == ["guest_relations"]
    assert out["sentiment"] == "frustrated"


def test_drops_unknown_department():
    raw = {
        "actions": [
            {"department": "vip_concierge_supervisor", "summary": "x", "priority": "normal"},
            {"department": "housekeeping", "summary": "Towels", "priority": "normal"},
        ],
        "intent": "amenity_request",
        "sentiment": "neutral",
        "confidence": 0.7,
    }
    out = normalize_classify_result(raw)
    assert len(out["actions"]) == 1
    assert out["actions"][0]["department"] == "housekeeping"


def test_empty_actions_raises():
    with pytest.raises(ValueError):
        normalize_classify_result({"actions": [], "intent": "x"})


def test_confidence_clamped():
    raw = {
        "actions": [
            {"department": "spa", "summary": "Book massage", "priority": "normal"}
        ],
        "confidence": 1.5,
        "sentiment": "happy",
    }
    out = normalize_classify_result(raw)
    assert out["confidence"] == 1.0
    assert out["sentiment"] == "positive"

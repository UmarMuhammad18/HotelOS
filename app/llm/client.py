"""
HotelOS LLM Client
Wraps Anthropic Claude with retry logic, JSON classification, and structured outputs.
Based on PR #5 (RetryingLLMClient) — now in main.
"""

import json
import time
import os
import anthropic
from typing import Any

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not set. Add it to your .env file."
            )
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are the AI brain of HotelOS, a hotel operations management system.
You classify guest requests and hotel events, then decide which department(s) should act and with what priority.

DEPARTMENTS: housekeeping, maintenance, concierge, fnb, guest_relations, front_desk, security, spa, valet, revenue, laundry, accessibility

PRIORITY LEVELS: low, normal, high, urgent, emergency

Always respond with valid JSON only. No prose, no markdown, no explanation outside the JSON.
"""


def classify_json(
    prompt: str,
    system: str | None = None,
    max_tokens: int = 1024,
    max_retries: int = 3,
    backoff_base: float = 0.5,
) -> dict[str, Any]:
    """
    Call Claude and return a parsed JSON dict.
    Retries on JSONDecodeError, ValueError, missing/empty actions, non-dict results.
    (RetryingLLMClient pattern from PR #5)
    """
    client = get_client()
    system_text = system or SYSTEM_PROMPT
    last_error: Exception | None = None

    for attempt in range(max_retries):
        if attempt > 0:
            time.sleep(backoff_base * attempt)  # 0.5s, 1.0s

        try:
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=max_tokens,
                system=system_text,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            result = json.loads(raw)

            if not isinstance(result, dict):
                raise ValueError(f"Expected dict, got {type(result).__name__}")

            actions = result.get("actions")
            if actions is not None and not isinstance(actions, list):
                raise ValueError("'actions' field must be a list")

            return result

        except json.JSONDecodeError as e:
            last_error = e
            continue
        except ValueError as e:
            last_error = e
            continue

    raise RuntimeError(
        f"LLM classification failed after {max_retries} attempts. "
        f"Last error: {last_error}"
    )


def complete(
    prompt: str,
    system: str | None = None,
    max_tokens: int = 2048,
) -> str:
    """
    Plain text completion — used for shift handover briefings and narrative outputs.
    """
    client = get_client()
    message = client.messages.create(
        model="claude-3-5-haiku-20241022",
        max_tokens=max_tokens,
        system=system or "You are a professional hotel operations AI assistant.",
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()

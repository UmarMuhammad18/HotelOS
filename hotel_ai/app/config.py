"""
Application settings.

Why this file exists
--------------------
We want every environment-specific knob (API keys, URLs, model name,
memory path) in one typed place. `pydantic-settings` reads from env vars
and .env automatically, and pydantic validates types at startup so we
fail loudly instead of leaking `None` into production code paths.
"""

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- LLM ---
    # Which provider to use. One of: "groq", "gemini", "anthropic", "fake".
    # If unset, falls back to whichever key is present (groq first, then
    # gemini, then anthropic). If none are set, FakeLLM is used.
    llm_provider: str = Field(default="", alias="LLM_PROVIDER")
    llm_model: str = Field(default="", alias="LLM_MODEL")

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")

    # --- Runtime ---
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # --- Memory ---
    # File path used by JSONFileStore. Ignored when DATABASE_URL is set
    # (Postgres takes over).
    guest_memory_path: str = Field(
        default="./data/guest_memory.json", alias="GUEST_MEMORY_PATH"
    )

    # File path used by JSONFileOutcomeStore. Ignored when DATABASE_URL
    # is set. Outcome records contain operational metadata (no PII), so
    # they can live longer than guest memory for benchmarking.
    outcome_store_path: str = Field(
        default="./data/outcomes.json", alias="OUTCOME_STORE_PATH"
    )

    # When set, the service uses Postgres instead of JSON for guest
    # memory. Format: postgresql://user:pass@host:5432/dbname
    # If empty, JSONFileStore is used (fine for single-worker dev).
    database_url: str = Field(default="", alias="DATABASE_URL")

    # Tag every outcome record with this property identifier. For
    # multi-property portfolios, run one service per property OR one
    # service that receives a `property_id` per event (future work).
    property_id: str = Field(default="default", alias="PROPERTY_ID")

    # --- Downstream services owned by backend team ---
    backend_notifications_url: str = Field(default="", alias="BACKEND_NOTIFICATIONS_URL")
    backend_tasks_url: str = Field(default="", alias="BACKEND_TASKS_URL")
    internal_api_token: str = Field(default="", alias="INTERNAL_API_TOKEN")

    # --- Quiet hours (Option C) ---
    # Hotel-local hours during which routine non-urgent work gets
    # deferred to the morning queue. Emergencies always bypass.
    # Format: 24h, integers. Default 22:00 → 07:00.
    quiet_hours_start: int = Field(default=22, alias="QUIET_HOURS_START")
    quiet_hours_end: int = Field(default=7, alias="QUIET_HOURS_END")

    # --- Repeat-issue detection (Option C) ---
    # Look-back window (hours) for "is the guest reporting the same
    # problem again". 24h is sensible; bump to 48 for slow-burn issues.
    repeat_issue_window_hours: int = Field(
        default=24, alias="REPEAT_ISSUE_WINDOW_HOURS"
    )
    # Number of similar prior reports needed to trigger escalation.
    repeat_issue_threshold: int = Field(default=2, alias="REPEAT_ISSUE_THRESHOLD")

    # --- Rate limiting (Option B) ---
    # Per-IP requests / minute on /v1/events. 0 disables rate limiting.
    rate_limit_per_minute: int = Field(default=60, alias="RATE_LIMIT_PER_MINUTE")


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — import this, don't construct Settings directly."""
    return Settings()

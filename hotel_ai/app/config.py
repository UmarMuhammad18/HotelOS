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
    llm_provider: str = Field(default="", alias="LLM_PROVIDER")
    llm_model: str = Field(default="", alias="LLM_MODEL")

    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")

    # --- Runtime ---
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # --- Memory ---
    guest_memory_path: str = Field(
        default="./data/guest_memory.json", alias="GUEST_MEMORY_PATH"
    )
    outcome_store_path: str = Field(
        default="./data/outcomes.json", alias="OUTCOME_STORE_PATH"
    )
    database_url: str = Field(default="", alias="DATABASE_URL")
    property_id: str = Field(default="default", alias="PROPERTY_ID")

    # --- Downstream services owned by backend team ---
    backend_notifications_url: str = Field(default="", alias="BACKEND_NOTIFICATIONS_URL")
    backend_tasks_url: str = Field(default="", alias="BACKEND_TASKS_URL")
    internal_api_token: str = Field(default="", alias="INTERNAL_API_TOKEN")

    # --- Quiet hours ---
    quiet_hours_start: int = Field(default=22, alias="QUIET_HOURS_START")
    quiet_hours_end: int = Field(default=7, alias="QUIET_HOURS_END")

    # --- Repeat-issue detection ---
    repeat_issue_window_hours: int = Field(
        default=24, alias="REPEAT_ISSUE_WINDOW_HOURS"
    )
    repeat_issue_threshold: int = Field(default=2, alias="REPEAT_ISSUE_THRESHOLD")

    # --- Rate limiting ---
    rate_limit_per_minute: int = Field(default=60, alias="RATE_LIMIT_PER_MINUTE")

    # --- Phase 4 / 5 ---
    moderation_api_key: str = Field(default="", alias="MODERATION_API_KEY")
    emergency_audit_path: str = Field(
        default="./data/emergency_audit.jsonl", alias="EMERGENCY_AUDIT_PATH"
    )
    redis_url: str = Field(default="", alias="REDIS_URL")
    enable_prometheus: bool = Field(default=True, alias="ENABLE_PROMETHEUS")


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — import this, don't construct Settings directly."""
    return Settings()

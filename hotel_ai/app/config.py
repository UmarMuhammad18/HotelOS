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
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- LLM ---
    # Which provider to use. One of: "gemini", "anthropic", "fake".
    # If unset, falls back to whichever key is present (gemini first, then
    # anthropic). If neither key is set, FakeLLM is used.
    llm_provider: str = Field(default="", alias="LLM_PROVIDER")
    llm_model: str = Field(default="", alias="LLM_MODEL")

    # Provider API keys — set only the one matching LLM_PROVIDER.
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")

    # --- Runtime ---
    environment: str = Field(default="development", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # --- Memory ---
    guest_memory_path: str = Field(default="./data/guest_memory.json", alias="GUEST_MEMORY_PATH")

    # --- Downstream services owned by backend team ---
    backend_notifications_url: str = Field(default="", alias="BACKEND_NOTIFICATIONS_URL")
    backend_tasks_url: str = Field(default="", alias="BACKEND_TASKS_URL")
    internal_api_token: str = Field(default="", alias="INTERNAL_API_TOKEN")


@lru_cache
def get_settings() -> Settings:
    """Cached singleton — import this, don't construct Settings directly."""
    return Settings()

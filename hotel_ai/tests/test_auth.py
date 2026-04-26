"""Tests for require_auth — the bearer-token check on /v1/* routes."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.routes import require_auth
from app.config import Settings, get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _patch_token(monkeypatch, token: str):
    fake_settings = Settings(INTERNAL_API_TOKEN=token)
    monkeypatch.setattr("app.api.routes.get_settings", lambda: fake_settings)


def test_dev_mode_bypasses_auth(monkeypatch):
    _patch_token(monkeypatch, "")
    require_auth(authorization="")
    require_auth(authorization="garbage")


def test_correct_bearer_token_passes(monkeypatch):
    _patch_token(monkeypatch, "secret-xyz")
    require_auth(authorization="Bearer secret-xyz")


@pytest.mark.parametrize("scheme", ["Bearer", "bearer", "BEARER", "BeArEr"])
def test_scheme_is_case_insensitive(monkeypatch, scheme):
    _patch_token(monkeypatch, "secret-xyz")
    require_auth(authorization=f"{scheme} secret-xyz")


def test_token_whitespace_is_stripped(monkeypatch):
    _patch_token(monkeypatch, "secret-xyz")
    require_auth(authorization="Bearer  secret-xyz  ")


def test_wrong_token_rejected(monkeypatch):
    _patch_token(monkeypatch, "secret-xyz")
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization="Bearer wrong")
    assert exc.value.status_code == 401


def test_missing_header_rejected(monkeypatch):
    _patch_token(monkeypatch, "secret-xyz")
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization="")
    assert exc.value.status_code == 401


def test_wrong_scheme_rejected(monkeypatch):
    _patch_token(monkeypatch, "secret-xyz")
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization="Basic secret-xyz")
    assert exc.value.status_code == 401


def test_token_only_no_scheme_rejected(monkeypatch):
    _patch_token(monkeypatch, "secret-xyz")
    with pytest.raises(HTTPException) as exc:
        require_auth(authorization="secret-xyz")
    assert exc.value.status_code == 401

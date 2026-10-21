"""Isolate local tests from .env files and external model credentials."""
import sys
import types
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
config = types.ModuleType("app.core.config")
config.settings = SimpleNamespace(
    llm_enabled=False,
    openai_api_key="fake-test-key",
    openai_base_url="https://invalid.example.test/v1",
    llm_model="fake-model",
    llm_temperature=0.2,
    llm_timeout=35,
    port=8086,
)
sys.modules["app.core.config"] = config


@pytest.fixture(autouse=True)
def isolated_model(monkeypatch):
    from app.services import ai_service

    monkeypatch.setattr(config.settings, "llm_enabled", False)
    monkeypatch.setattr(config.settings, "llm_timeout", 35)
    monkeypatch.setattr(ai_service, "_llm", None)
    monkeypatch.setattr(ai_service, "_model_status", "configured", raising=False)


@pytest.fixture
def model_reply(monkeypatch):
    from app.services import ai_service

    def set_reply(reply=None, error=None):
        monkeypatch.setattr(config.settings, "llm_enabled", True)

        async def fake_invoke(_prompt, _variables):
            if error:
                raise error
            return reply

        monkeypatch.setattr(ai_service, "_invoke", fake_invoke)

    return set_reply

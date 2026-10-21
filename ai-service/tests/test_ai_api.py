import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ai_service
from app.services import rule_engine


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize("path,payload", [
    ("optimize-bullet", {"content": "   "}),
    ("optimize-bullet", {"content": "x" * 6001}),
    ("optimize-bullet", {"content": 123}),
    ("generate-summary", {"resume_info": "\n"}),
    ("generate-summary", {"resume_info": "x" * 40001}),
    ("ats-score", {"resume_content": " "}),
    ("parse-jd", {"job_description": ""}),
    ("parse-jd", {"job_description": "x" * 20001}),
    ("match-skills", {"resume_content": "Java", "job_description": " "}),
    ("translate", {"content": "经历", "target_lang": "ja"}),
    ("translate", {"content": "经历", "target_lang": 1}),
    ("interview-questions", {"resume_content": " "}),
    ("optimize-bullets", {"bullets": []}),
    ("optimize-bullets", {"bullets": [{"id": "a", "content": ""}]}),
    ("optimize-bullets", {"bullets": [{"id": "a", "content": "经历"}] * 2}),
    ("optimize-bullets", {"bullets": [{"id": str(i), "content": "经历"} for i in range(31)]}),
    ("optimize-bullets", {"bullets": [{"id": str(i), "content": "x" * 3000} for i in range(30)]}),
    ("optimize-bullets", {"content": "old unsupported contract"}),
])
def test_invalid_requests_use_safe_envelope(client, path, payload):
    response = client.post(f"/api/ai/{path}", json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == 422
    assert body["data"] is None
    assert "detail" not in body
    assert len(body["message"]) < 300


def test_missing_field_does_not_echo_sensitive_input(client):
    response = client.post("/api/ai/generate-summary", json={"secret": "private-input-marker"})
    assert response.status_code == 422
    assert "private-input-marker" not in response.text
    assert response.json()["data"] is None


def test_request_trims_whitespace(client, monkeypatch):
    received = []

    async def optimize(job_title, content):
        received.append((job_title, content))
        return {"result": content, "engine": "rule"}

    monkeypatch.setattr(ai_service, "optimize_bullet", optimize)
    response = client.post("/api/ai/optimize-bullet", json={"job_title": " 护士 ", "content": " 参与护理实习 "})
    assert response.status_code == 200
    assert received == [("护士", "参与护理实习")]


def test_batch_contract_preserves_original_identity_and_text(client):
    bullets = [{"id": "row-2", "content": " 参与活动策划 "}, {"id": "row-1", "content": "整理客户资料"}]
    response = client.post("/api/ai/optimize-bullets", json={"job_title": "运营", "bullets": bullets})
    assert response.status_code == 200
    data = response.json()["data"]
    assert [item["id"] for item in data["items"]] == [item["id"] for item in bullets]
    assert [item["before"] for item in data["items"]] == [item["content"] for item in bullets]
    assert all(item["after"] and item["engine"] == "rule" for item in data["items"])


def test_health_distinguishes_configuration_from_availability(client, model_reply):
    assert client.get("/api/ai/health").json()["data"]["modelStatus"] == "unconfigured"
    model_reply("参与活动策划")
    configured = client.get("/api/ai/health").json()["data"]
    assert configured["llmEnabled"] is True
    assert configured["modelStatus"] == "configured"
    client.post("/api/ai/optimize-bullet", json={"content": "参与活动策划"})
    assert client.get("/api/ai/health").json()["data"]["modelStatus"] == "available"
    model_reply(error=TimeoutError("secret-key-marker"))
    result = client.post("/api/ai/optimize-bullet", json={"content": "参与活动策划"}).json()["data"]
    assert result["engine"] == "rule"
    assert "secret-key-marker" not in str(result)
    assert client.get("/api/ai/health").json()["data"]["modelStatus"] == "unavailable"
    model_reply("参与活动策划")
    client.post("/api/ai/optimize-bullet", json={"content": "参与活动策划"})
    assert client.get("/api/ai/health").json()["data"]["modelStatus"] == "available"


def test_unexpected_exception_has_safe_error(client, monkeypatch):
    async def broken(*_args):
        raise RuntimeError("private-api-key-marker")

    monkeypatch.setattr(ai_service, "generate_summary", broken)
    response = client.post("/api/ai/generate-summary", json={"resume_info": "护理实习经历"})
    assert response.status_code == 500
    assert response.json()["code"] == 500
    assert response.json()["data"] is None
    assert "private-api-key-marker" not in response.text


def test_unknown_route_has_envelope(client):
    response = client.get("/api/ai/not-a-route")
    assert response.status_code == 404
    assert response.json()["code"] == 404


def test_invalid_rule_output_cannot_escape_response_schema(client, monkeypatch):
    monkeypatch.setattr(rule_engine, "ats_score_local", lambda *_args: {
        "scores": {key: True for key in ("keywords", "skills", "experience", "education", "overall")},
        "suggestions": ["检查实际经历"], "matchedSkills": [], "missingSkills": [], "engine": "rule",
    })
    response = client.post("/api/ai/ats-score", json={"resume_content": "参与活动策划"})
    assert response.status_code == 500
    assert response.json()["data"] is None


def test_jd_response_preserves_nullable_contract_fields(client):
    response = client.post("/api/ai/parse-jd", json={"job_description": "负责活动策划"})
    assert response.status_code == 200
    assert "years" in response.json()["data"]
    assert response.json()["data"]["years"] is None
    assert "education" in response.json()["data"]
    assert response.json()["data"]["education"] is None

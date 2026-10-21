import asyncio
import json
from types import SimpleNamespace

import pytest
from langchain_core.runnables import RunnableLambda

from app.core.config import settings
from app.services import ai_service as ai


def run(awaitable):
    return asyncio.run(awaitable)


def ats_payload():
    return {"scores": {key: 80 for key in ("keywords", "skills", "experience", "education", "overall")},
            "suggestions": ["请在项目经历中补充实际产出。"], "matchedSkills": ["活动策划"], "missingSkills": []}


@pytest.mark.parametrize("key,value", [
    ("keywords", -1), ("skills", 101), ("experience", True), ("education", "90"), ("overall", 99.5),
])
def test_ats_rejects_non_integer_or_out_of_range_score(model_reply, key, value):
    data = ats_payload()
    data["scores"][key] = value
    model_reply(json.dumps(data))
    result = run(ai.ats_score("运营 活动策划", "参与活动策划"))
    assert result["engine"] == "rule"
    assert result["fallbackReason"] == "invalid_output"
    assert all(type(value) is int and 0 <= value <= 100 for value in result["scores"].values())


@pytest.mark.parametrize("payload", [
    {}, [], {"scores": {}}, {**ats_payload(), "suggestions": "wrong-type"},
    {**ats_payload(), "matchedSkills": [{}]}, {**ats_payload(), "missingSkills": "Excel"},
])
def test_ats_rejects_incomplete_or_invalid_json(model_reply, payload):
    model_reply(json.dumps(payload))
    assert run(ai.ats_score("运营 活动策划", "参与活动策划"))["engine"] == "rule"


def test_ats_accepts_valid_fenced_json(model_reply):
    model_reply("```json\n" + json.dumps(ats_payload()) + "\n```")
    result = run(ai.ats_score("运营 活动策划", "参与活动策划"))
    assert result["engine"] == "llm"
    assert result["scores"]["overall"] == 80
    assert result["matchedSkills"] == ["活动策划"]


@pytest.mark.parametrize("payload", [{}, [], {"skills": "Excel"},
    {"skills": [], "years": {}, "education": None, "responsibilities": [], "requirements": []},
    {"skills": [], "years": None, "education": None, "responsibilities": [], "requirements": []},
])
def test_jd_rejects_invalid_or_meaningless_structure(model_reply, payload):
    model_reply(json.dumps(payload))
    result = run(ai.parse_jd("本科及以上学历，熟悉活动策划"))
    assert result["engine"] == "rule"
    assert result["fallbackReason"] == "invalid_output"


def test_jd_validates_and_filters_unrecognized_model_fields(model_reply):
    payload = {"skills": ["活动策划"], "years": None, "education": "本科", "responsibilities": ["策划活动"], "requirements": [], "arbitrary": "private"}
    model_reply(json.dumps(payload))
    result = run(ai.parse_jd("本科及以上学历，负责活动策划"))
    assert result["engine"] == "llm"
    assert result["skills"] == ["活动策划"]
    assert "arbitrary" not in result


def test_jd_accepts_omitted_optional_model_fields(model_reply):
    model_reply(json.dumps({"skills": ["活动策划"], "responsibilities": ["负责活动策划"]}))
    result = run(ai.parse_jd("负责活动策划并要求具备活动策划能力"))
    assert result["engine"] == "llm"
    assert result["years"] is None
    assert result["education"] is None
    assert result["requirements"] == []


def test_batch_calls_model_once_and_restores_request_order(monkeypatch):
    calls = []
    monkeypatch.setattr(settings, "llm_enabled", True)

    async def reply(_prompt, variables):
        calls.append(variables)
        return json.dumps({"items": [{"id": "b", "after": "整理客户资料"}, {"id": "a", "after": "参与活动策划", "before": "模型伪造原文"}]})

    monkeypatch.setattr(ai, "_invoke", reply)
    bullets = [{"id": "a", "content": " 参与活动策划 "}, {"id": "b", "content": "整理客户资料"}]
    result = run(ai.optimize_bullets("运营", bullets))
    assert len(calls) == 1
    assert [item["id"] for item in result["items"]] == ["a", "b"]
    assert [item["before"] for item in result["items"]] == [bullet["content"] for bullet in bullets]
    assert result["engine"] == "llm"


@pytest.mark.parametrize("items", [
    [], [{"id": "a", "after": "参与活动策划"}],
    [{"id": "a", "after": "参与活动策划"}, {"id": "a", "after": "整理资料"}],
    [{"id": "a", "after": "参与活动策划"}, {"id": "unknown", "after": "整理资料"}],
    [{"id": "a", "after": " "}, {"id": "b", "after": "整理资料"}],
])
def test_batch_invalid_mapping_falls_back_as_one_operation(model_reply, items):
    model_reply(json.dumps({"items": items}))
    bullets = [{"id": "a", "content": "参与活动策划"}, {"id": "b", "content": "整理资料"}]
    result = run(ai.optimize_bullets("运营", bullets))
    assert result["engine"] == "rule"
    assert len(result["items"]) == 2
    assert all(item["engine"] == "rule" for item in result["items"])
    assert result["fallbackReason"] == "invalid_output"


@pytest.mark.parametrize("operation", [
    lambda: ai.optimize_bullet("运营", "参与活动策划"),
    lambda: ai.generate_summary("运营实习，参与活动策划"),
    lambda: ai.ats_score("运营", "参与活动策划"),
    lambda: ai.parse_jd("运营，负责活动策划"),
    lambda: ai.interview_questions("运营", "参与活动策划"),
])
def test_unconfigured_model_skips_provider_and_returns_notice(monkeypatch, operation):
    async def forbidden(*_args):
        pytest.fail("unconfigured mode must not invoke the provider")

    monkeypatch.setattr(ai, "_invoke", forbidden)
    result = run(operation())
    assert result["engine"] == "rule"
    assert result["notice"]
    assert result["fallbackReason"] == "unconfigured"


def test_full_call_timeout_is_bounded_and_recovers(monkeypatch):
    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(settings, "llm_timeout", 0.01)
    cancelled = []

    async def slow(*_args):
        try:
            await asyncio.sleep(1)
        finally:
            cancelled.append(True)

    monkeypatch.setattr(ai, "_invoke", slow)
    result = run(ai.optimize_bullet("运营", "参与活动策划"))
    assert result["engine"] == "rule"
    assert result["fallbackReason"] == "timeout"
    assert cancelled == [True]


@pytest.mark.parametrize("target,expected", [("en", "英文"), ("zh", "中文")])
def test_translate_uses_selected_language(monkeypatch, target, expected):
    monkeypatch.setattr(settings, "llm_enabled", True)
    seen = []

    async def reply(prompt, variables):
        seen.append(prompt.format(**variables))
        return "Translated content"

    monkeypatch.setattr(ai, "_invoke", reply)
    assert run(ai.translate("实习经历", target))["engine"] == "llm"
    assert expected in seen[0]


def test_translation_unavailable_has_no_applicable_text():
    result = run(ai.translate("实习经历", "en"))
    assert result["engine"] == "none"
    assert result["result"] == ""
    assert result["notice"]


@pytest.mark.parametrize("before,after", [
    ("参与活动策划", "主导活动策划"),
    ("参与活动策划", "参与活动策划，转化率提升30%"),
    ("参与3场活动策划", "参与活动策划"),
])
def test_optimization_rejects_invented_duties_or_changed_numbers(model_reply, before, after):
    model_reply(after)
    result = run(ai.optimize_bullet("运营", before))
    assert result["engine"] == "rule"
    assert result["fallbackReason"] == "invalid_output"


def test_applicable_body_has_no_service_messages_or_advice():
    result = run(ai.optimize_bullet("护士", "参与护理实习"))
    assert "优化建议" not in result["result"]
    assert "配置" not in result["result"]
    assert "建议补充" not in result["result"]
    assert not result["result"].startswith("•")
    assert isinstance(result["suggestions"], list)


@pytest.mark.parametrize("payload", ['{}', '{"questions":"wrong-type"}', '{"questions":[{}]}', '{"questions":[]}'])
def test_interview_rejects_invalid_question_lists(model_reply, payload):
    model_reply(payload)
    result = run(ai.interview_questions("护士", "参与护理实习"))
    assert result["engine"] == "rule"


def test_provider_configuration_disables_retries_and_caps_timeout(monkeypatch):
    seen = {}
    monkeypatch.setattr(settings, "llm_enabled", True)
    monkeypatch.setattr(settings, "llm_timeout", 999)

    def fake_provider(**kwargs):
        seen.update(kwargs)
        return RunnableLambda(lambda _prompt: SimpleNamespace(content="参与活动策划"))

    monkeypatch.setattr(ai, "ChatOpenAI", fake_provider)
    result = run(ai.optimize_bullet("运营", "参与活动策划"))
    assert result["engine"] == "llm"
    assert seen["max_retries"] == 0
    assert seen["timeout"] <= 40


def test_optimization_accepts_equivalent_numeric_formatting(model_reply):
    model_reply("参与 3 场活动策划，满意度为 30％")
    result = run(ai.optimize_bullet("运营", "参与3场活动策划，满意度为30%"))
    assert result["engine"] == "llm"


@pytest.mark.parametrize("before,after", [
    ("具备3年护理经验", "具备3个月护理经验"),
    ("Assisted with campaign planning", "Led campaign planning"),
    ("负责活动策划", "独立设计活动方案"),
])
def test_optimization_rejects_changed_units_or_responsibility(model_reply, before, after):
    model_reply(after)
    assert run(ai.optimize_bullet("运营", before))["engine"] == "rule"


@pytest.mark.parametrize("raw", ["", "  ", None, ["not-text"], "抱歉，我无法生成简历内容。"])
def test_summary_rejects_empty_nontext_or_refusal(model_reply, raw):
    model_reply(raw)
    result = run(ai.generate_summary("参与护理实习"))
    assert result["engine"] == "rule"
    assert result["fallbackReason"] == "invalid_output"


def test_summary_valid_output_preserves_role(model_reply):
    model_reply("护理专业学生，参与护理实习。")
    assert run(ai.generate_summary("护理专业学生，参与护理实习"))["engine"] == "llm"


def test_interview_valid_question_list(model_reply):
    questions = ["你在护理实习中承担什么职责？", "你如何做好交接？", "请介绍一次沟通经历。"]
    model_reply(json.dumps({"questions": questions}, ensure_ascii=False))
    result = run(ai.interview_questions("护士", "参与护理实习"))
    assert result["engine"] == "llm"
    assert result["questions"] == questions


def test_model_failure_does_not_leak_exception_in_logs(model_reply, caplog):
    model_reply(error=RuntimeError("private-input-and-key-marker"))
    result = run(ai.optimize_bullet("运营", "参与活动策划"))
    assert result["fallbackReason"] == "provider_error"
    assert "private-input-and-key-marker" not in caplog.text


def test_summary_rejects_invented_chinese_experience_number(model_reply):
    model_reply("具备五年护理经验。")
    assert run(ai.generate_summary("护理专业学生，参与护理实习"))["engine"] == "rule"


def test_deeply_nested_model_json_falls_back_instead_of_crashing(model_reply):
    model_reply('{"scores":' + '[' * 20000 + '0' + ']' * 20000 + '}')
    result = run(ai.ats_score("运营", "参与活动策划"))
    assert result["engine"] == "rule"
    assert result["fallbackReason"] == "invalid_output"


@pytest.mark.parametrize("raw", [
    "### 优化结果：\n1. 参与活动策划",
    "优化结果：参与活动策划",
    "```text\n• 参与活动策划\n```",
])
def test_optimization_strips_model_formatting_from_applicable_body(model_reply, raw):
    model_reply(raw)
    result = run(ai.optimize_bullet("运营", "参与活动策划"))
    assert result["engine"] == "llm"
    assert result["result"] == "参与活动策划"


def test_optimization_rejects_inline_advice_in_body(model_reply):
    model_reply("参与活动策划，建议补充已核实的活动结果")
    result = run(ai.optimize_bullet("运营", "参与活动策划"))
    assert result["engine"] == "rule"
    assert "建议补充" not in result["result"]

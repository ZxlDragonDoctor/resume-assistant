"""
AI Service 核心逻辑。

策略：**优先调用 LLM，失败或无 Key 时降级到规则引擎**。
这样无论环境如何，接口都能返回有意义的响应，
前端不会出现「空白弹窗」或「服务异常」。
"""
from __future__ import annotations

import json
import logging
import re

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

from app.core.config import settings
from app.services import rule_engine as rules

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# LLM 初始化（惰性）
# ------------------------------------------------------------------

_llm: ChatOpenAI | None = None


def get_llm() -> ChatOpenAI | None:
    global _llm
    if not settings.llm_enabled:
        return None
    if _llm is None:
        _llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            timeout=settings.llm_timeout,
            max_retries=1,
        )
    return _llm


def llm_available() -> bool:
    return settings.llm_enabled


# ------------------------------------------------------------------
# Prompt 模板
# ------------------------------------------------------------------

OPTIMIZE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "你是一位资深简历顾问，服务过大量互联网技术岗候选人。"
        "请把用户提供的工作/项目描述改写为专业的简历要点。\n"
        "硬性要求：\n"
        "1. 使用 STAR 法则组织信息，动词前置（主导/设计/搭建/优化/落地等）\n"
        "2. 尽可能保留并突出数字成果；若原文没有数字，不要编造，改写为可量化的句式\n"
        "3. 每条要点控制在一行内，不超过 60 字\n"
        "4. 若输入是多行，逐行输出，每行以「• 」开头\n"
        "5. 只输出优化后的要点本身，不要任何解释、前言或 markdown 标题",
    ),
    ("human", "目标岗位：{job_title}\n原始描述：\n{content}"),
])

SUMMARY_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "你是一位简历顾问。请根据候选人信息撰写一段个人总结。\n"
        "要求：\n"
        "1. 150-220 字，一段话，不要分点\n"
        "2. 第一句点明身份与年限，中间说明核心技术栈与擅长解决的问题，结尾表达求职意向\n"
        "3. 语气专业克制，不使用「精通一切」这类夸张表述\n"
        "4. 只输出总结正文",
    ),
    ("human", "候选人信息：\n{resume_info}"),
])

ATS_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "你是一位 ATS（简历筛选系统）专家。请评估简历与职位描述的匹配度。\n"
        "从四个维度打分（0-100 整数）：\n"
        "- keywords：岗位关键词覆盖率\n"
        "- skills：技能匹配度\n"
        "- experience：经验相关性与成果量化程度\n"
        "- education：学历与年限匹配\n"
        "- overall：加权综合分\n"
        "同时给出 3-6 条**具体可执行**的改进建议，每条需指明改哪个模块、怎么改。\n"
        "严格只输出 JSON，不要 markdown 代码块，格式：\n"
        '{{"scores":{{"keywords":0,"skills":0,"experience":0,"education":0,"overall":0}},'
        '"suggestions":["建议1","建议2"],"matchedSkills":["Java"],"missingSkills":["Kafka"]}}',
    ),
    ("human", "职位描述：\n{job_description}\n\n简历内容：\n{resume_content}"),
])

JD_PARSE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "请从职位描述中抽取结构化信息，严格只输出 JSON，不要 markdown 代码块：\n"
        '{{"skills":["技能1"],"years":"3-5年","education":"本科",'
        '"responsibilities":["职责1"],"requirements":["要求1"]}}\n'
        "skills 请使用招聘市场通用的英文技术名词（如 Spring Boot、Redis）。",
    ),
    ("human", "{job_description}"),
])

TRANSLATE_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "你是专业的简历翻译。请把简历内容翻译为英文，保持专业术语准确"
        "（如「实习经历」→ Internship Experience）。"
        "保留原有分行结构。只输出译文，不要解释。",
    ),
    ("human", "{content}"),
])

INTERVIEW_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        "你是技术面试官。请根据候选人简历与目标岗位生成 8 条最可能被问到的面试问题。\n"
        "要求：覆盖项目深挖、技术原理、行为面三类，问题要具体到简历里出现的技术名词。\n"
        "每行一个问题，不要编号以外的多余文字。",
    ),
    ("human", "岗位：{job_title}\n简历：\n{resume_content}"),
])


# ------------------------------------------------------------------
# 通用调用封装
# ------------------------------------------------------------------

async def _invoke(prompt: ChatPromptTemplate, variables: dict) -> str:
    llm = get_llm()
    if llm is None:
        raise RuntimeError("LLM 未配置")
    chain = prompt | llm
    result = await chain.ainvoke(variables)
    return (result.content or "").strip()


def _parse_json_block(text: str) -> dict:
    """LLM 输出常带 ```json 包裹，这里做容错解析。"""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except json.JSONDecodeError:
                pass
    raise ValueError("无法解析模型返回的 JSON")


# ------------------------------------------------------------------
# 对外能力
# ------------------------------------------------------------------

async def optimize_bullet(job_title: str, content: str) -> dict:
    """润色经历要点。"""
    if not content or not content.strip():
        return {"result": "请先填写要优化的经历描述。", "engine": "none"}

    try:
        result = await _invoke(OPTIMIZE_PROMPT, {
            "job_title": job_title or "未指定",
            "content": content,
        })
        if result:
            return {"result": result, "engine": "llm"}
    except Exception as exc:  # noqa: BLE001 - 任何 LLM 异常都降级
        logger.warning("LLM 优化失败，降级到规则引擎: %s", exc)

    return {"result": rules.optimize_bullet_local(job_title, content), "engine": "rule"}


async def generate_summary(resume_info: str) -> dict:
    """生成个人总结。"""
    if not resume_info or not resume_info.strip():
        return {"result": "请先填写简历信息后再生成总结。", "engine": "none"}

    try:
        result = await _invoke(SUMMARY_PROMPT, {"resume_info": resume_info})
        if result:
            return {"result": result, "engine": "llm"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM 总结失败，降级到规则引擎: %s", exc)

    return {"result": rules.generate_summary_local(resume_info), "engine": "rule"}


async def ats_score(job_description: str, resume_content: str) -> dict:
    """ATS 匹配度评分。"""
    if not resume_content or not resume_content.strip():
        return {
            "scores": {"keywords": 0, "skills": 0, "experience": 0,
                       "education": 0, "overall": 0},
            "suggestions": ["请先填写简历内容再进行评分。"],
            "engine": "none",
        }

    try:
        raw = await _invoke(ATS_PROMPT, {
            "job_description": job_description or "（未提供）",
            "resume_content": resume_content,
        })
        data = _parse_json_block(raw)
        scores = data.get("scores") or {}
        normalized = {
            "keywords": int(scores.get("keywords", 0)),
            "skills": int(scores.get("skills", 0)),
            "experience": int(scores.get("experience", 0)),
            "education": int(scores.get("education", 0)),
            "overall": int(scores.get("overall", 0)),
        }
        return {
            "scores": normalized,
            "suggestions": data.get("suggestions") or [],
            "matchedSkills": data.get("matchedSkills") or [],
            "missingSkills": data.get("missingSkills") or [],
            "engine": "llm",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM 评分失败，降级到规则引擎: %s", exc)

    return rules.ats_score_local(job_description, resume_content)


async def parse_jd(job_description: str) -> dict:
    """解析职位描述，抽取技能/年限/学历/职责。"""
    if not job_description or not job_description.strip():
        return {"skills": [], "years": None, "education": None,
                "responsibilities": [], "requirements": [], "engine": "none"}

    try:
        raw = await _invoke(JD_PARSE_PROMPT, {"job_description": job_description})
        data = _parse_json_block(raw)
        data["engine"] = "llm"
        return data
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM JD 解析失败，降级到规则引擎: %s", exc)

    return rules.parse_jd_local(job_description)


async def translate(content: str, target_lang: str = "en") -> dict:
    """简历内容翻译（用于投递外企/海外岗位）。"""
    if not content or not content.strip():
        return {"result": "", "engine": "none"}

    try:
        result = await _invoke(TRANSLATE_PROMPT, {"content": content})
        if result:
            return {"result": result, "engine": "llm"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM 翻译失败: %s", exc)

    return {
        "result": "翻译功能需要配置 AI 服务的 API Key 后可用。",
        "engine": "none",
    }


async def interview_questions(job_title: str, resume_content: str) -> dict:
    """预测面试问题。"""
    try:
        raw = await _invoke(INTERVIEW_PROMPT, {
            "job_title": job_title or "未指定",
            "resume_content": resume_content or "（未提供）",
        })
        questions = [q.strip(" -•*0123456789.") for q in raw.splitlines() if q.strip()]
        if questions:
            return {"questions": questions, "engine": "llm"}
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM 面试题生成失败，降级到规则引擎: %s", exc)

    return {
        "questions": rules.interview_questions_local(job_title, resume_content),
        "engine": "rule",
    }

"""
AI 服务路由。

所有接口统一返回 {code, message, data} 结构，与 Java 服务的 R<T> 保持一致，
前端可以用同一套拦截器处理。
"""
import logging

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services import ai_service
from app.services import rule_engine as rules

logger = logging.getLogger(__name__)
router = APIRouter()


# ------------------------------------------------------------------
# 请求模型
# ------------------------------------------------------------------

class OptimizeRequest(BaseModel):
    job_title: str = ""
    content: str = Field(..., description="待优化的经历描述")


class SummaryRequest(BaseModel):
    resume_info: str = Field(..., description="简历信息汇总文本")


class AtsRequest(BaseModel):
    job_description: str = ""
    resume_content: str = ""


class JdParseRequest(BaseModel):
    job_description: str = ""


class TranslateRequest(BaseModel):
    content: str = ""
    target_lang: str = "en"


class InterviewRequest(BaseModel):
    job_title: str = ""
    resume_content: str = ""


class MatchSkillsRequest(BaseModel):
    resume_content: str = ""
    job_description: str = ""


def ok(data):
    return {"code": 200, "message": "success", "data": data}


# ------------------------------------------------------------------
# 路由
# ------------------------------------------------------------------

@router.get("/health")
async def health():
    """暴露 LLM 是否可用，前端可据此提示用户当前是「AI 模式」还是「规则模式」"""
    return ok({
        "status": "ok",
        "llmEnabled": ai_service.llm_available(),
        "engine": "llm" if ai_service.llm_available() else "rule",
    })


@router.post("/optimize-bullet")
async def api_optimize_bullet(req: OptimizeRequest):
    result = await ai_service.optimize_bullet(req.job_title, req.content)
    return ok(result)


@router.post("/optimize-bullets")
async def api_optimize_bullets(req: OptimizeRequest):
    """批量优化：一次传入多行，返回逐条结果（前端「一键优化本模块」）"""
    result = await ai_service.optimize_bullet(req.job_title, req.content)
    return ok(result)


@router.post("/generate-summary")
async def api_generate_summary(req: SummaryRequest):
    result = await ai_service.generate_summary(req.resume_info)
    return ok(result)


@router.post("/ats-score")
async def api_ats_score(req: AtsRequest):
    result = await ai_service.ats_score(req.job_description, req.resume_content)
    return ok(result)


@router.post("/parse-jd")
async def api_parse_jd(req: JdParseRequest):
    """解析 JD，返回技能 / 年限 / 学历 / 职责，用于「岗位画像」面板"""
    result = await ai_service.parse_jd(req.job_description)
    return ok(result)


@router.post("/match-skills")
async def api_match_skills(req: MatchSkillsRequest):
    """技能匹配（纯规则，无需 LLM，响应快）"""
    return ok(rules.match_skills_local(req.resume_content, req.job_description))


@router.post("/translate")
async def api_translate(req: TranslateRequest):
    """简历内容翻译（中英对照投递）"""
    result = await ai_service.translate(req.content, req.target_lang)
    return ok(result)


@router.post("/interview-questions")
async def api_interview_questions(req: InterviewRequest):
    """面试问题预测"""
    result = await ai_service.interview_questions(req.job_title, req.resume_content)
    return ok(result)

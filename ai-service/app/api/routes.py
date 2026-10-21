"""
AI 服务路由。

所有接口统一返回 {code, message, data} 结构，与 Java 服务的 R<T> 保持一致，
前端可以用同一套拦截器处理。
"""
from fastapi import APIRouter

from app.schemas import (
    AtsRequest, AtsResponse, BatchResponse, HealthResponse, InterviewRequest,
    InterviewResponse, JdParseRequest, JdResponse, MatchSkillsRequest, MatchSkillsResponse,
    OptimizeBulletsRequest, OptimizeRequest, SummaryRequest, TranslateRequest,
    SuccessResponse, TextResponse,
)
from app.services import ai_service
from app.services import rule_engine as rules

router = APIRouter()


def ok(data):
    return {"code": 200, "message": "success", "data": data}


# ------------------------------------------------------------------
# 路由
# ------------------------------------------------------------------

@router.get("/health", response_model=SuccessResponse[HealthResponse], response_model_exclude_unset=True)
async def health():
    """Configuration and the most recent validated model call are separate states."""
    model_status = ai_service.model_status()
    return ok({
        "status": "ok",
        "llmEnabled": ai_service.llm_available(),
        "modelStatus": model_status,
        "engine": "llm" if model_status == "available" else "rule",
    })


@router.post("/optimize-bullet", response_model=SuccessResponse[TextResponse], response_model_exclude_unset=True)
async def api_optimize_bullet(req: OptimizeRequest):
    result = await ai_service.optimize_bullet(req.job_title, req.content)
    return ok(result)


@router.post("/optimize-bullets", response_model=SuccessResponse[BatchResponse], response_model_exclude_unset=True)
async def api_optimize_bullets(req: OptimizeBulletsRequest):
    """One result for each original editor bullet, in request order."""
    result = await ai_service.optimize_bullets(
        req.job_title, [item.model_dump() for item in req.bullets],
    )
    return ok(result)


@router.post("/generate-summary", response_model=SuccessResponse[TextResponse], response_model_exclude_unset=True)
async def api_generate_summary(req: SummaryRequest):
    result = await ai_service.generate_summary(req.resume_info)
    return ok(result)


@router.post("/ats-score", response_model=SuccessResponse[AtsResponse], response_model_exclude_unset=True)
async def api_ats_score(req: AtsRequest):
    result = await ai_service.ats_score(req.job_description, req.resume_content)
    return ok(result)


@router.post("/parse-jd", response_model=SuccessResponse[JdResponse], response_model_exclude_unset=True)
async def api_parse_jd(req: JdParseRequest):
    """解析 JD，返回技能 / 年限 / 学历 / 职责，用于「岗位画像」面板"""
    result = await ai_service.parse_jd(req.job_description)
    return ok(result)


@router.post("/match-skills", response_model=SuccessResponse[MatchSkillsResponse], response_model_exclude_unset=True)
async def api_match_skills(req: MatchSkillsRequest):
    """技能匹配（纯规则，无需 LLM，响应快）"""
    return ok(rules.match_skills_local(req.resume_content, req.job_description))


@router.post("/translate", response_model=SuccessResponse[TextResponse], response_model_exclude_unset=True)
async def api_translate(req: TranslateRequest):
    """简历内容翻译（中英对照投递）"""
    result = await ai_service.translate(req.content, req.target_lang)
    return ok(result)


@router.post("/interview-questions", response_model=SuccessResponse[InterviewResponse], response_model_exclude_unset=True)
async def api_interview_questions(req: InterviewRequest):
    """面试问题预测"""
    result = await ai_service.interview_questions(req.job_title, req.resume_content)
    return ok(result)

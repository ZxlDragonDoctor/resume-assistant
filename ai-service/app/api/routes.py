from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_service import optimize_bullet, generate_summary, ats_score

router = APIRouter()


class OptimizeRequest(BaseModel):
    job_title: str = ""
    content: str


class SummaryRequest(BaseModel):
    resume_info: str


class AtsRequest(BaseModel):
    job_description: str
    resume_content: str


@router.post("/optimize-bullet")
async def api_optimize_bullet(req: OptimizeRequest):
    try:
        result = await optimize_bullet(req.job_title, req.content)
        return {"code": 200, "data": {"result": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-summary")
async def api_generate_summary(req: SummaryRequest):
    try:
        result = await generate_summary(req.resume_info)
        return {"code": 200, "data": {"result": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ats-score")
async def api_ats_score(req: AtsRequest):
    try:
        result = await ats_score(req.job_description, req.resume_content)
        return {"code": 200, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

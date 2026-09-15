"""
AI Service 入口。

统一通过网关暴露在 /api/ai/**，对外提供简历优化、ATS 评分、
JD 解析、翻译与面试题预测等能力。
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.core.config import settings
from app.services import ai_service
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Resume AI Service",
    version="2.0.0",
    description="简历智能优化 / ATS 评分 / JD 解析 / 翻译 / 面试题预测",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(router, prefix="/api/ai")


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request, exc: Exception):
    """兜底异常处理，保证前端始终拿到结构化响应而不是 500 HTML"""
    logger.exception("未处理异常: %s", exc)
    return JSONResponse(
        status_code=200,
        content={"code": 500, "message": str(exc), "data": None},
    )


@app.on_event("startup")
async def on_startup():
    engine = "LLM" if ai_service.llm_available() else "本地规则引擎"
    logger.info("AI Service 启动完成，当前引擎：%s", engine)
    if not ai_service.llm_available():
        logger.info(
            "未检测到 OPENAI_API_KEY，AI 接口将使用本地规则引擎。"
            "在 .env 中配置 Key 即可启用大模型能力。"
        )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)

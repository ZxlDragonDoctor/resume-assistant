"""
AI Service 入口。

统一通过网关暴露在 /api/ai/**，对外提供简历优化、ATS 评分、
JD 解析、翻译与面试题预测等能力。
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.api.routes import router
from app.core.config import settings
from app.services import ai_service
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("AI Service 启动完成，模型状态：%s", ai_service.model_status())
    yield


app = FastAPI(
    title="Resume AI Service",
    version="2.0.0",
    description="简历智能优化 / ATS 评分 / JD 解析 / 翻译 / 面试题预测",
    lifespan=lifespan,
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
    # Exception strings can contain provider credentials or resume contents.
    logger.error("未处理的 AI 服务异常：%s", type(exc).__name__)
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务暂时不可用，请稍后重试。", "data": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request, _exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"code": 422, "message": "请求参数无效，请检查必填内容、长度与格式。", "data": None},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request, exc: HTTPException):
    message = "请求路径不存在。" if exc.status_code == 404 else "请求无法处理，请检查请求方式。"
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "message": message, "data": None},
        headers=exc.headers,
    )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)

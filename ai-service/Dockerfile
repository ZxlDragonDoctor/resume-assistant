# ============================================================================
# ai-service —— Python FastAPI + LangChain（通义千问 / OpenAI 兼容端点）
# ----------------------------------------------------------------------------
# 所有配置都通过环境变量注入（见 app/core/config.py）：
#   OPENAI_API_KEY / OPENAI_BASE_URL / LLM_MODEL 决定用哪家大模型，
#   换供应商无需改代码。未提供 Key 时自动降级到本地规则引擎。
#
# 因此本镜像**不内置任何密钥**，密钥在 docker-compose environment
# 或部署平台的 Secrets 中注入。
# ============================================================================

FROM python:3.13-slim

# 避免 .pyc、stdout 缓冲（便于 docker logs 实时看日志）
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 先装依赖（单独一层，利用缓存）
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# 以非 root 用户运行
RUN useradd -m -u 10001 appuser && chown -R appuser:appuser /app
USER appuser

ENV PORT=8086
EXPOSE 8086

# 健康检查：/docs 由 FastAPI 自动提供，只要能连上就说明进程存活
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.getenv(\"PORT\",\"8086\")}/docs',timeout=3)" || exit 1

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8086}"]

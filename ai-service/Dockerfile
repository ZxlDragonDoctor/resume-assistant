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

# 包源镜像 —— 与 Maven/Alpine 同理：从中国大陆直连官方源
# (pypi.org / deb.debian.org) 会非常慢甚至超时，构建时间不可控。
# 这里默认走国内镜像，境外环境可通过 --build-arg 置空回退官方源。
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG APT_MIRROR=mirrors.tuna.tsinghua.edu.cn

RUN set -eux; \
    if [ -n "$APT_MIRROR" ]; then \
      # 基础镜像的 sources.list 是 deb822 格式（/etc/apt/sources.list.d/debian.sources）
      if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
      fi; \
      if [ -f /etc/apt/sources.list ]; then \
        sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list; \
      fi; \
    fi

# 避免 .pyc、stdout 缓冲（便于 docker logs 实时看日志）
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# 先装依赖（单独一层，利用缓存）
COPY requirements.txt ./
RUN pip install --no-cache-dir -i "$PIP_INDEX_URL" -r requirements.txt

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

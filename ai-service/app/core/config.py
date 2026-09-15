"""
AI Service 配置。

所有字段都可以通过环境变量覆盖；未配置 API Key 时，
服务会自动降级到本地规则引擎（见 services/rule_engine.py），
保证功能可用、前端不出现空白。
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ---------------- LLM ----------------
    # 默认指向通义千问 DashScope 的 OpenAI 兼容端点；换成 DeepSeek / OpenAI
    # 只需改这三个环境变量即可，无需动代码。
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: str = os.getenv(
        "OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
    )
    llm_model: str = os.getenv("LLM_MODEL", "qwen-max")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.6"))
    llm_timeout: int = int(os.getenv("LLM_TIMEOUT", "60"))

    # ---------------- 缓存 ----------------
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    cache_ttl: int = int(os.getenv("CACHE_TTL", "3600"))

    # ---------------- 服务 ----------------
    port: int = int(os.getenv("PORT", "8086"))

    @property
    def llm_enabled(self) -> bool:
        """是否具备真实 LLM 能力。无 Key 时使用规则引擎兜底。"""
        return bool(self.openai_api_key and self.openai_api_key.strip())


settings = Settings()

from fastapi import FastAPI
from app.api.routes import router
from app.core.config import settings
import uvicorn

app = FastAPI(title="Resume AI Service", version="1.0.0")
app.include_router(router, prefix="/api/ai")


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8086, reload=True)

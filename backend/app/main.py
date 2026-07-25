from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.session import init_db
from app.db.redis_client import init_redis
from app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🛡️  LLM-Guard starting...")
    await init_db()
    await init_redis()
    print("✅ Ready — visit http://localhost:8000/docs")
    yield
    print("LLM-Guard stopped.")


app = FastAPI(
    title="LLM-Guard API",
    description="AI Prompt Firewall — Security Posture Management",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000, 1)
    print(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response


@app.exception_handler(Exception)
async def global_exc(request: Request, exc: Exception):
    print(f"ERROR {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"error": str(exc)})


app.include_router(router, prefix=settings.api_prefix)


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}

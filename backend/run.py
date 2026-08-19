"""Run the LLM-Guard backend."""
import os
import uvicorn

if __name__ == "__main__":
    is_dev = os.getenv("ENVIRONMENT", "development").lower() in ("development", "dev", "local")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=is_dev,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )

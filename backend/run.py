"""Run the LLM-Guard backend. Execute: python run.py"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,        # auto-reload on code changes
        log_level="info",
    )

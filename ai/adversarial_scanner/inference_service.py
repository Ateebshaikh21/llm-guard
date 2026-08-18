"""
LLM-Guard ML Inference Service
Run:  python inference_service.py
Port: 8001

Loads a pre-trained model on startup.
If no model is found, trains one using the canonical ml_training module.
"""
import logging
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ml_training import (
    CLF_PATH,
    VEC_PATH,
    load_model_safe,
    train_production_model,
    save_model,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LLM-Guard ML Inference", version="1.0.0")

_clf = None
_vec = None
_model_error: str = ""


@app.on_event("startup")
async def load_model():
    global _clf, _vec, _model_error

    clf, vec, error = load_model_safe()

    if clf is not None:
        _clf, _vec = clf, vec
        logger.info("[ML] Loaded pre-trained model from %s", CLF_PATH.parent)
        return

    if error:
        logger.warning("[ML] Could not load model (%s) — training bootstrap model", error)

    try:
        _clf, _vec = train_production_model(verbose=True)
        save_model(_clf, _vec)
        logger.info("[ML] Bootstrap model trained and saved.")
    except Exception as exc:
        _model_error = f"Bootstrap training failed: {exc}"
        logger.error("[ML] %s", _model_error)


class ScanRequest(BaseModel):
    text: str


class ScanResponse(BaseModel):
    jailbreak_probability: float
    label: str


@app.post("/scan", response_model=ScanResponse)
async def scan(req: ScanRequest):
    if _clf is None or _vec is None:
        return JSONResponse(
            status_code=503,
            content={"error": "Model not available", "detail": _model_error or "Loading"},
        )

    threshold = float(os.getenv("ML_BLOCK_THRESHOLD", "0.75"))

    try:
        X = _vec.transform([req.text])
        proba = _clf.predict_proba(X)[0]
        classes = list(_clf.classes_)

        # Safe class lookup — validated on load, but be explicit here too
        if "jailbreak" not in classes:
            logger.error("[ML] Unexpected model classes: %s", classes)
            return JSONResponse(status_code=503, content={"error": "Model class configuration error"})

        idx   = classes.index("jailbreak")
        score = float(proba[idx])
        label = "jailbreak" if score >= threshold else "benign"
        return ScanResponse(jailbreak_probability=round(score, 4), label=label)

    except Exception as exc:
        logger.error("[ML] Inference error: %s", exc)
        return JSONResponse(status_code=503, content={"error": "Inference failed"})


@app.get("/health")
async def health():
    return {
        "status": "ok" if _clf is not None else "degraded",
        "model_loaded": _clf is not None,
        "model_error": _model_error or None,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")

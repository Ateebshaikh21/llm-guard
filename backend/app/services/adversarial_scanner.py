"""ML adversarial scanner — calls inference service, falls back to local model."""
import json, hashlib
from dataclasses import dataclass
from typing import Optional
import httpx
from app.core.config import settings

_local_clf = None
_local_vec = None


@dataclass
class ScanResult:
    jailbreak_probability: float
    label: str
    blocked: bool
    source: str


def _heuristic(text: str) -> ScanResult:
    keywords = [
        "ignore previous", "ignore all", "disregard", "jailbreak", "dan mode",
        "do anything now", "no restrictions", "bypass", "developer mode",
        "pretend you", "act as if", "sudo mode", "uncensored", "unrestricted",
        "forget your", "new persona", "evil ai", "without guidelines",
    ]
    hits = sum(1 for kw in keywords if kw in text.lower())
    score = min(0.4 + hits * 0.15, 0.99)
    blocked = score >= settings.ml_block_threshold
    return ScanResult(jailbreak_probability=score, label="jailbreak" if blocked else "benign", blocked=blocked, source="heuristic")


def _load_local():
    global _local_clf, _local_vec
    if _local_clf:
        return True
    try:
        import joblib
        _local_clf = joblib.load(settings.ml_model_path)
        _local_vec = joblib.load(settings.ml_model_path.replace("classifier.pkl", "vectorizer.pkl"))
        return True
    except Exception:
        return False


def _local_predict(text: str) -> ScanResult:
    if not _load_local():
        return _heuristic(text)
    try:
        X = _local_vec.transform([text])
        proba = _local_clf.predict_proba(X)[0]
        classes = list(_local_clf.classes_)
        idx = classes.index("jailbreak") if "jailbreak" in classes else 1
        score = float(proba[idx])
        blocked = score >= settings.ml_block_threshold
        return ScanResult(jailbreak_probability=score, label="jailbreak" if blocked else "benign", blocked=blocked, source="local_model")
    except Exception:
        return _heuristic(text)


async def scan_prompt(text: str) -> ScanResult:
    # Cache check
    cache_key = f"scan:{hashlib.sha256(text.encode()).hexdigest()[:32]}"
    from app.db.redis_client import get_redis
    redis = get_redis()
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                d = json.loads(cached)
                return ScanResult(**{**d, "source": "cache"})
        except Exception:
            pass

    # Try ML inference service
    result: Optional[ScanResult] = None
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(f"{settings.ml_inference_url}/scan", json={"text": text})
            if resp.status_code == 200:
                d = resp.json()
                score = d["jailbreak_probability"]
                blocked = score >= settings.ml_block_threshold
                result = ScanResult(jailbreak_probability=score, label=d["label"], blocked=blocked, source="ml_service")
    except Exception:
        pass

    if result is None:
        result = _local_predict(text)

    # Cache result
    if redis:
        try:
            await redis.set(cache_key, json.dumps({
                "jailbreak_probability": result.jailbreak_probability,
                "label": result.label,
                "blocked": result.blocked,
            }), ex=300)
        except Exception:
            pass

    return result

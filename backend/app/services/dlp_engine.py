"""DLP Engine using Microsoft Presidio. Falls back gracefully if spaCy model not available."""
import json, uuid
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from app.core.config import settings

_analyzer = None
_anonymizer = None

logger = logging.getLogger(__name__)

def _filter_results(results):
    """Filter Presidio results based on configured confidence threshold."""
    return [
        result
        for result in results
        if result.score >= settings.dlp_confidence_threshold
    ]

def _analyze_text(text: str):
    """Analyze text and return filtered Presidio detections."""
    results = _analyzer.analyze(
        text=text,
        language=settings.dlp_language
    )
    return _filter_results(results)


def _init_presidio():
    if not settings.dlp_enabled:
       return False
    
    global _analyzer, _anonymizer
    if _analyzer is not None:
        return True
    try:
        from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
        from presidio_anonymizer import AnonymizerEngine
        _analyzer = AnalyzerEngine()
        _anonymizer = AnonymizerEngine()

        # Custom: API keys
        _analyzer.registry.add_recognizer(PatternRecognizer(
            supported_entity="API_KEY",
            patterns=[
                Pattern("OpenAI", r"sk-[A-Za-z0-9]{32,}", 0.95),
                Pattern("AWS", r"AKIA[0-9A-Z]{16}", 0.95),
                Pattern("GitHub", r"gh[pousr]_[A-Za-z0-9_]{36}", 0.9),
            ],
            name="ApiKeyRecognizer",
        ))
        return True
    except Exception as e:
        logger.warning("Presidio initialization failed. DLP engine is disabled. Error: %s", e)
        return False


@dataclass
class DlpResult:
    masked_text: str
    session_id: str
    entities_found: List[str] = field(default_factory=list)
    count: int = 0


async def mask_prompt(text: str) -> DlpResult:
    if not _init_presidio():
        return DlpResult(masked_text=text, session_id="")

    try:
        results = _analyze_text(text)

        if not results:
            return DlpResult(masked_text=text, session_id="")

        session_id = str(uuid.uuid4())
        mapping: Dict[str, str] = {}
        masked = text

        # Replace from right to left to preserve indices
        for i, r in enumerate(sorted(results, key=lambda x: x.start, reverse=True)):
            original = text[r.start:r.end]
            placeholder = f"<{r.entity_type}_{i}>"
            mapping[placeholder] = original
            masked = masked[:r.start] + placeholder + masked[r.end:]

        # Store mapping in Redis if available, else in-memory dict
        from app.db.redis_client import get_redis
        redis = get_redis()
        if redis:
            await redis.set(f"dlp:{session_id}", json.dumps(mapping), ex=settings.dlp_redis_ttl)
        else:
            _in_memory_store[session_id] = mapping

        entities = list({r.entity_type for r in results})
        return DlpResult(masked_text=masked, session_id=session_id, entities_found=entities, count=len(results))
    except Exception:
        logger.exception("Failed to mask sensitive data in the prompt.")
        return DlpResult(masked_text=text, session_id="")


# Fallback in-memory store when Redis is unavailable
_in_memory_store: Dict[str, Dict] = {}

async def unmask_response(text: str, session_id: str) -> str:
    if not session_id:
        return text

    mapping = None
    from app.db.redis_client import get_redis
    redis = get_redis()
    if redis:
        raw = await redis.get(f"dlp:{session_id}")
        if raw:
            mapping = json.loads(raw)
            await redis.delete(f"dlp:{session_id}")
    else:
        mapping = _in_memory_store.pop(session_id, None)

    if not mapping:
        return text

    restored = text
    for placeholder, original in mapping.items():
        restored = restored.replace(placeholder, original)
    return restored


async def scan_output(text: str) -> Tuple[bool, List[str]]:
    if not _init_presidio():
        return False, []
    try:
        results = _analyze_text(text)
        if results:
            return True, list({r.entity_type for r in results})
    except Exception:
        logger.exception("Failed to scan LLM response for sensitive data.")
    return False, []

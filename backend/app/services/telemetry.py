import hashlib
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.prompt_log import PromptLog, ClassificationResult, DlpMaskEvent
from app.models.audit import AuditLog


def hash_prompt(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


async def log_prompt_decision(
    db: AsyncSession,
    user_id: str,
    prompt_text: str,
    status: str,
    block_reason: Optional[str] = None,
    triggered_rule_id: Optional[str] = None,
    jailbreak_probability: Optional[float] = None,
    ml_label: Optional[str] = None,
    dlp_entities: Optional[List[str]] = None,
) -> str:
    entry = PromptLog(
        user_id=user_id,
        prompt_text_hash=hash_prompt(prompt_text),
        status=status,
        block_reason=block_reason,
        triggered_rule_id=triggered_rule_id,
    )
    db.add(entry)
    await db.flush()

    if jailbreak_probability is not None and ml_label:
        db.add(ClassificationResult(prompt_id=entry.prompt_id, jailbreak_probability=jailbreak_probability, label=ml_label))

    if dlp_entities:
        from collections import Counter
        for etype, count in Counter(dlp_entities).items():
            db.add(DlpMaskEvent(prompt_id=entry.prompt_id, entity_type=etype, occurrences=count))

    return entry.prompt_id


async def log_audit_event(db: AsyncSession, action: str, user_id: Optional[str] = None, details: Optional[dict] = None):
    db.add(AuditLog(user_id=user_id, action=action, details=details))

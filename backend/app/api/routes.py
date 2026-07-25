"""All API routes in one file."""
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import (get_current_user, require_role,
                                hash_password, verify_password, create_access_token)
from app.db.session import get_db
from app.models.user import AppUser, Organization
from app.models.rule import FirewallRule
from app.models.prompt_log import PromptLog, ClassificationResult
from app.models.audit import AuditLog
from app.schemas import (
    LoginRequest, TokenResponse, UserOut, UserCreate,
    FirewallRuleCreate, FirewallRuleUpdate, FirewallRuleOut,
    InspectRequest, InspectResponse, ClassificationDetail, DlpDetail,
    PromptLogOut, PromptLogDetail,
    StatsSummary, RuleCount, DailyVolume,
    RedTeamRunRequest, RedTeamRunResult, AttackResult,
    AuditLogOut,
)
from app.services import rules_engine, adversarial_scanner, dlp_engine, output_validator, llm_connector
from app.services.telemetry import log_prompt_decision, log_audit_event

router = APIRouter()
ORG_ID = "00000000-0000-0000-0000-000000000001"   # single-tenant default

# ── In-memory red-team run store ──────────────────────────────────────
_redteam_runs: dict = {}


# ════════════════════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════════════════════
@router.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppUser).where(AppUser.email == body.email))
    user: AppUser | None = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token({"sub": user.user_id, "role": user.role_id, "org": user.org_id})
    await log_audit_event(db, "user_login", user.user_id, {"email": user.email})
    return TokenResponse(
        access_token=token,
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=user.user_id, role=user.role_id, email=user.email,
    )


@router.get("/auth/me", response_model=UserOut, tags=["Auth"])
async def me(current_user: AppUser = Depends(get_current_user)):
    return current_user


@router.post("/auth/register", response_model=UserOut, status_code=201, tags=["Auth"])
async def register(body: UserCreate, db: AsyncSession = Depends(get_db),
                   _: AppUser = Depends(require_role("admin"))):
    if (await db.execute(select(AppUser).where(AppUser.email == body.email))).scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = AppUser(email=body.email, hashed_password=hash_password(body.password),
                   role_id=body.role_id, org_id=body.org_id)
    db.add(user)
    await db.flush()
    await log_audit_event(db, "user_created", details={"email": body.email})
    return user


# ════════════════════════════════════════════════════════════════════════
# PROXY / INSPECT  (full pipeline)
# ════════════════════════════════════════════════════════════════════════
@router.post("/proxy/inspect", response_model=InspectResponse, tags=["Proxy"])
async def inspect(body: InspectRequest, db: AsyncSession = Depends(get_db),
                  current_user: AppUser = Depends(get_current_user)):
    full_prompt = " ".join(m.content for m in body.messages if m.role == "user")

    # Step 1 — Rules
    rule_result = await rules_engine.evaluate_rules(full_prompt, db, current_user.org_id, settings.max_prompt_length)
    if rule_result.blocked:
        pid = await log_prompt_decision(db, current_user.user_id, full_prompt, "blocked",
                                        rule_result.reason, rule_result.triggered_rule_id)
        return InspectResponse(prompt_id=pid, status="blocked", block_reason=rule_result.reason)

    # Step 2 — ML
    scan = await adversarial_scanner.scan_prompt(full_prompt)
    if scan.blocked:
        pid = await log_prompt_decision(db, current_user.user_id, full_prompt, "blocked",
                                        f"ML: {scan.label} ({scan.jailbreak_probability:.0%})",
                                        jailbreak_probability=scan.jailbreak_probability, ml_label=scan.label)
        return InspectResponse(
            prompt_id=pid, status="blocked",
            block_reason=f"Adversarial content detected ({scan.label}, {scan.jailbreak_probability:.0%} confidence)",
            classification=ClassificationDetail(jailbreak_probability=scan.jailbreak_probability, label=scan.label),
        )

    # Step 3 — DLP mask
    dlp = await dlp_engine.mask_prompt(full_prompt)
    masked_msgs = [
        {"role": m.role, "content": dlp.masked_text if m.role == "user" else m.content}
        for m in body.messages
    ]

    # Step 4 — LLM
    try:
        raw_response = await llm_connector.complete(masked_msgs, body.model, body.temperature, body.max_tokens)
    except Exception as e:
        raise HTTPException(502, f"LLM error: {e}")

    # Step 5 — Validate + unmask
    validation = await output_validator.validate_output(raw_response)
    final = await dlp_engine.unmask_response(validation.sanitized_text, dlp.session_id)

    status_flag = "modified" if dlp.count > 0 else "allowed"
    pid = await log_prompt_decision(db, current_user.user_id, full_prompt, status_flag,
                                    jailbreak_probability=scan.jailbreak_probability, ml_label=scan.label,
                                    dlp_entities=dlp.entities_found)
    return InspectResponse(
        prompt_id=pid, status=status_flag,
        classification=ClassificationDetail(jailbreak_probability=scan.jailbreak_probability, label=scan.label),
        dlp=DlpDetail(entities_masked=dlp.entities_found, count=dlp.count) if dlp.count else None,
        response=final,
    )


# ════════════════════════════════════════════════════════════════════════
# FIREWALL RULES
# ════════════════════════════════════════════════════════════════════════
@router.get("/rules", response_model=List[FirewallRuleOut], tags=["Rules"])
async def list_rules(db: AsyncSession = Depends(get_db), current_user: AppUser = Depends(get_current_user)):
    r = await db.execute(select(FirewallRule).where(FirewallRule.org_id == current_user.org_id).order_by(FirewallRule.created_at.desc()))
    return r.scalars().all()


@router.post("/rules", response_model=FirewallRuleOut, status_code=201, tags=["Rules"])
async def create_rule(body: FirewallRuleCreate, db: AsyncSession = Depends(get_db),
                      current_user: AppUser = Depends(require_role("admin", "soc_analyst"))):
    rule = FirewallRule(**body.model_dump(), org_id=current_user.org_id)
    db.add(rule)
    await db.flush()
    await log_audit_event(db, "rule_created", current_user.user_id, body.model_dump())
    return rule


@router.patch("/rules/{rule_id}", response_model=FirewallRuleOut, tags=["Rules"])
async def update_rule(rule_id: str, body: FirewallRuleUpdate, db: AsyncSession = Depends(get_db),
                      current_user: AppUser = Depends(require_role("admin", "soc_analyst"))):
    r = await db.execute(select(FirewallRule).where(FirewallRule.rule_id == rule_id, FirewallRule.org_id == current_user.org_id))
    rule = r.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    await log_audit_event(db, "rule_updated", current_user.user_id, {"rule_id": rule_id})
    return rule


@router.delete("/rules/{rule_id}", status_code=204, tags=["Rules"])
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db),
                      current_user: AppUser = Depends(require_role("admin"))):
    r = await db.execute(select(FirewallRule).where(FirewallRule.rule_id == rule_id, FirewallRule.org_id == current_user.org_id))
    rule = r.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await log_audit_event(db, "rule_deleted", current_user.user_id, {"rule_id": rule_id})


# ════════════════════════════════════════════════════════════════════════
# PROMPT LOGS
# ════════════════════════════════════════════════════════════════════════
@router.get("/logs/prompts", response_model=List[PromptLogOut], tags=["Logs"])
async def list_logs(status: Optional[str] = None, limit: int = Query(50, le=500), offset: int = 0,
                    db: AsyncSession = Depends(get_db), current_user: AppUser = Depends(get_current_user)):
    filters = []
    if status:
        filters.append(PromptLog.status == status)
    if current_user.role_id == "employee":
        filters.append(PromptLog.user_id == current_user.user_id)

    q = (select(PromptLog).options(selectinload(PromptLog.classification))
         .where(and_(*filters) if filters else True)
         .order_by(PromptLog.submitted_at.desc()).limit(limit).offset(offset))
    result = await db.execute(q)
    logs = result.scalars().all()
    return [PromptLogOut(
        prompt_id=l.prompt_id, user_id=l.user_id, status=l.status,
        block_reason=l.block_reason, submitted_at=l.submitted_at,
        jailbreak_probability=l.classification.jailbreak_probability if l.classification else None,
        label=l.classification.label if l.classification else None,
    ) for l in logs]


@router.get("/logs/prompts/{prompt_id}", response_model=PromptLogDetail, tags=["Logs"])
async def get_log(prompt_id: str, db: AsyncSession = Depends(get_db),
                  current_user: AppUser = Depends(get_current_user)):
    r = await db.execute(
        select(PromptLog).options(selectinload(PromptLog.classification), selectinload(PromptLog.dlp_events))
        .where(PromptLog.prompt_id == prompt_id))
    log = r.scalar_one_or_none()
    if not log:
        raise HTTPException(404, "Not found")
    if current_user.role_id == "employee" and log.user_id != current_user.user_id:
        raise HTTPException(403, "Access denied")
    return PromptLogDetail(
        prompt_id=log.prompt_id, user_id=log.user_id, status=log.status,
        block_reason=log.block_reason, submitted_at=log.submitted_at,
        jailbreak_probability=log.classification.jailbreak_probability if log.classification else None,
        label=log.classification.label if log.classification else None,
        dlp_events=[{"entity_type": e.entity_type, "occurrences": e.occurrences} for e in log.dlp_events],
    )


# ════════════════════════════════════════════════════════════════════════
# STATS
# ════════════════════════════════════════════════════════════════════════
@router.get("/stats/summary", response_model=StatsSummary, tags=["Stats"])
async def stats_summary(range: str = "7d", db: AsyncSession = Depends(get_db),
                         current_user: AppUser = Depends(get_current_user)):
    days = {"1d": 1, "7d": 7, "30d": 30, "90d": 90}.get(range, 7)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    total = (await db.execute(select(func.count(PromptLog.prompt_id)).where(PromptLog.submitted_at >= since))).scalar() or 0
    status_q = await db.execute(
        select(PromptLog.status, func.count(PromptLog.prompt_id))
        .where(PromptLog.submitted_at >= since).group_by(PromptLog.status))
    sm = {r[0]: r[1] for r in status_q.all()}

    blocked, modified, allowed = sm.get("blocked", 0), sm.get("modified", 0), sm.get("allowed", 0)
    block_rate = round(blocked / total * 100, 2) if total > 0 else 0.0

    rule_q = await db.execute(
        select(PromptLog.block_reason, func.count(PromptLog.prompt_id))
        .where(PromptLog.status == "blocked", PromptLog.submitted_at >= since)
        .group_by(PromptLog.block_reason).order_by(func.count(PromptLog.prompt_id).desc()).limit(5))
    top_rules = [RuleCount(rule=r[0] or "unknown", count=r[1]) for r in rule_q.all()]

    daily_q = await db.execute(
        select(func.date(PromptLog.submitted_at).label("day"), func.count().label("total"),
               func.sum(func.cast(PromptLog.status == "blocked", func.count().type)).label("blocked"))
        .where(PromptLog.submitted_at >= since).group_by(func.date(PromptLog.submitted_at))
        .order_by(func.date(PromptLog.submitted_at)))
    daily = [DailyVolume(date=str(r[0]), total=r[1] or 0, blocked=int(r[2] or 0)) for r in daily_q.all()]

    return StatsSummary(
        org_id=current_user.org_id, total_prompts=total, blocked_prompts=blocked,
        modified_prompts=modified, allowed_prompts=allowed, block_rate_percent=block_rate,
        top_triggered_rules=top_rules, daily_volume=daily, generated_at=datetime.now(timezone.utc),
    )


# ════════════════════════════════════════════════════════════════════════
# RED TEAM
# ════════════════════════════════════════════════════════════════════════
@router.post("/redteam/run", response_model=RedTeamRunResult, tags=["Red Team"])
async def run_redteam(body: RedTeamRunRequest, current_user: AppUser = Depends(require_role("admin"))):
    from pathlib import Path
    corpus_dir = Path(__file__).parent.parent.parent.parent / "ai" / "red_team_simulator" / "prompt_corpus"
    corpus_file = corpus_dir / f"{body.corpus_name}.txt"
    if not corpus_file.exists():
        raise HTTPException(404, f"Corpus '{body.corpus_name}' not found")

    prompts = [l.strip() for l in corpus_file.read_text().splitlines() if l.strip()]
    if body.limit:
        prompts = prompts[:body.limit]

    started = datetime.now(timezone.utc)
    run_id = str(uuid.uuid4())
    results = []

    for prompt in prompts:
        scan = await adversarial_scanner.scan_prompt(prompt)
        results.append(AttackResult(
            prompt=prompt[:200], blocked=scan.blocked,
            jailbreak_probability=scan.jailbreak_probability,
            block_reason=f"{scan.label} ({scan.jailbreak_probability:.0%})" if scan.blocked else None,
        ))

    blocked_count = sum(1 for r in results if r.blocked)
    total = len(results)
    block_rate = round(blocked_count / total * 100, 2) if total > 0 else 0.0

    run = RedTeamRunResult(
        run_id=run_id, corpus_name=body.corpus_name, total_attacks=total,
        blocked_count=blocked_count, passed_count=total - blocked_count,
        block_rate_percent=block_rate, gate_passed=block_rate >= 95.0,
        results=results, started_at=started, completed_at=datetime.now(timezone.utc),
    )
    _redteam_runs[run_id] = run
    return run


@router.get("/redteam/results/{run_id}", response_model=RedTeamRunResult, tags=["Red Team"])
async def get_redteam_result(run_id: str, current_user: AppUser = Depends(require_role("admin"))):
    r = _redteam_runs.get(run_id)
    if not r:
        raise HTTPException(404, "Run not found")
    return r


# ════════════════════════════════════════════════════════════════════════
# AUDIT LOG
# ════════════════════════════════════════════════════════════════════════
@router.get("/audit-log", response_model=List[AuditLogOut], tags=["Audit"])
async def get_audit(limit: int = Query(100, le=1000), db: AsyncSession = Depends(get_db),
                    current_user: AppUser = Depends(require_role("admin"))):
    r = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit))
    return r.scalars().all()

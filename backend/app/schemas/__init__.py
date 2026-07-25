from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    role: str
    email: str

class UserOut(BaseModel):
    user_id: str
    email: str
    role_id: str
    org_id: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class UserCreate(BaseModel):
    email: str
    password: str
    role_id: str = "employee"
    org_id: str

class UserUpdate(BaseModel):
    role_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserManagementOut(BaseModel):
    users: List[UserOut]
    total: int
    role_counts: Dict[str, int]


# ── Rules ─────────────────────────────────────────────────────────────
class FirewallRuleCreate(BaseModel):
    rule_type: str
    rule_value: str
    description: Optional[str] = None
    active: bool = True

class FirewallRuleUpdate(BaseModel):
    rule_type: Optional[str] = None
    rule_value: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class FirewallRuleOut(BaseModel):
    rule_id: str
    org_id: str
    rule_type: str
    rule_value: str
    description: Optional[str]
    active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Prompt ────────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class InspectRequest(BaseModel):
    messages: List[Message]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 1024

class ClassificationDetail(BaseModel):
    jailbreak_probability: float
    label: str

class DlpDetail(BaseModel):
    entities_masked: List[str]
    count: int

class InspectResponse(BaseModel):
    prompt_id: str
    status: str
    block_reason: Optional[str] = None
    classification: Optional[ClassificationDetail] = None
    dlp: Optional[DlpDetail] = None
    response: Optional[str] = None

class PromptLogOut(BaseModel):
    prompt_id: str
    user_id: str
    status: str
    block_reason: Optional[str]
    submitted_at: datetime
    jailbreak_probability: Optional[float] = None
    label: Optional[str] = None
    model_config = {"from_attributes": True}

class PromptLogDetail(PromptLogOut):
    dlp_events: List[Dict[str, Any]] = []


# ── Stats ─────────────────────────────────────────────────────────────
class RuleCount(BaseModel):
    rule: str
    count: int

class DailyVolume(BaseModel):
    date: str
    total: int
    blocked: int

class StatsSummary(BaseModel):
    org_id: str
    total_prompts: int
    blocked_prompts: int
    modified_prompts: int
    allowed_prompts: int
    block_rate_percent: float
    top_triggered_rules: List[RuleCount]
    daily_volume: List[DailyVolume]
    generated_at: datetime


# ── Red Team ──────────────────────────────────────────────────────────
class RedTeamRunRequest(BaseModel):
    corpus_name: str = "default"
    limit: Optional[int] = None

class AttackResult(BaseModel):
    prompt: str
    blocked: bool
    jailbreak_probability: Optional[float]
    block_reason: Optional[str]

class RedTeamRunResult(BaseModel):
    run_id: str
    corpus_name: str
    total_attacks: int
    blocked_count: int
    passed_count: int
    block_rate_percent: float
    gate_passed: bool
    results: List[AttackResult]
    started_at: datetime
    completed_at: datetime


# ── Audit ─────────────────────────────────────────────────────────────
class AuditLogOut(BaseModel):
    log_id: str
    user_id: Optional[str]
    action: str
    details: Optional[Dict[str, Any]]
    timestamp: datetime
    model_config = {"from_attributes": True}

import re
from dataclasses import dataclass
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.rule import FirewallRule

BUILTIN_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"disregard\s+(all\s+)?previous",
        r"forget\s+(all\s+)?previous",
        r"you\s+are\s+now\s+DAN",
        r"do\s+anything\s+now",
        r"pretend\s+you\s+have\s+no\s+restrictions",
        r"act\s+as\s+if\s+you\s+have\s+no.*(filter|restriction|guideline)",
        r"bypass\s+(your\s+)?(safety|content)\s+(filter|guardrail|restriction)",
        r"developer\s+mode",
        r"sudo\s+mode",
        r"enable\s+unrestricted\s+mode",
        r"jailbreak",
    ]
]


@dataclass
class RuleCheckResult:
    blocked: bool
    reason: Optional[str] = None
    triggered_rule_id: Optional[str] = None


async def evaluate_rules(prompt_text: str, db: AsyncSession, org_id: str, max_length: int = 4000) -> RuleCheckResult:
    # 1. Length
    if len(prompt_text) > max_length:
        return RuleCheckResult(blocked=True, reason=f"Prompt exceeds maximum length of {max_length} characters.")

    # 2. Built-in patterns
    for pattern in BUILTIN_PATTERNS:
        if pattern.search(prompt_text):
            return RuleCheckResult(blocked=True, reason=f"Built-in rule matched: '{pattern.pattern}'")

    # 3. DB rules
    result = await db.execute(
        select(FirewallRule).where(FirewallRule.org_id == org_id, FirewallRule.active == True)
    )
    rules: List[FirewallRule] = result.scalars().all()

    for rule in rules:
        matched = False
        match rule.rule_type:
            case "keyword":
                matched = rule.rule_value.lower() in prompt_text.lower()
            case "regex":
                try:
                    matched = bool(re.search(rule.rule_value, prompt_text, re.IGNORECASE))
                except re.error:
                    pass
            case "length":
                try:
                    matched = len(prompt_text) > int(rule.rule_value)
                except ValueError:
                    pass
            case "system_prompt_guard":
                matched = rule.rule_value.lower() in prompt_text.lower()

        if matched:
            return RuleCheckResult(
                blocked=True,
                reason=f"Rule matched ({rule.rule_type}): '{rule.rule_value}'",
                triggered_rule_id=rule.rule_id,
            )

    return RuleCheckResult(blocked=False)

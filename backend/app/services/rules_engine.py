import logging
import re
from dataclasses import dataclass
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.rule import FirewallRule
from app.core.config import settings

BUILTIN_RULES = [
    # ------------------------------------------------------------------
    # Prompt Injection / Jailbreak
    # ------------------------------------------------------------------
    {
        "name": "Prompt Injection",
        "patterns": [
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
        ],
    },

    # ------------------------------------------------------------------
    # SQL Injection
    # ------------------------------------------------------------------
    {
        "name": "SQL Injection",
        "patterns": [
            r"\bunion\s+(all\s+)?select\b",
            r"\bdrop\s+table\b",
            r"\btruncate\s+table\b",
            r"\balter\s+table\b",
            r"\binsert\s+into\b",
            r"\bdelete\s+from\b",
            r"\bupdate\s+\w+\s+set\b",
            r"\bexec(?:ute)?\b",
            r"\bxp_cmdshell\b",
            r"\binformation_schema\b",
            r"\bload_file\s*\(",
            r"\binto\s+outfile\b",
            r"\binto\s+dumpfile\b",
            r"\bsleep\s*\(",
            r"\bbenchmark\s*\(",
            r"\bwaitfor\s+delay\b",
            r"(?:'|\"|\))\s*(?:or|and)\s*(?:'?\d+'?\s*=\s*'?\d+'?)",
        ],
    },

    # ------------------------------------------------------------------
    # Cross-Site Scripting (XSS)
    # ------------------------------------------------------------------
    {
        "name": "Cross-Site Scripting (XSS)",
        "patterns": [
            r"<script\b[^>]*>",
            r"</script>",
            r"javascript\s*:",
            r"vbscript\s*:",
            r"<iframe\b",
            r"<object\b",
            r"<embed\b",
            r"<svg\b[^>]*>",
            r"<img\b[^>]*\bonerror\s*=",
            r"<body\b[^>]*\bonload\s*=",
            r"\bon(?:error|load|click|mouseover|focus)\s*=",
            r"document\.cookie",
            r"document\.location",
            r"window\.location",
            r"eval\s*\(",
            r"String\.fromCharCode\s*\(",
        ],
    },
]

COMPILED_BUILTIN_RULES = [
    {
        "name": rule["name"],
        "patterns": [
            re.compile(pattern, re.IGNORECASE)
            for pattern in rule["patterns"]
        ],
    }
    for rule in BUILTIN_RULES
]

logger = logging.getLogger(__name__)


@dataclass
class RuleCheckResult:
    blocked: bool
    reason: Optional[str] = None
    triggered_rule_id: Optional[str] = None


def _match_rule(
    rule: FirewallRule,
    prompt_text: str,
    normalized_prompt: str,
) -> bool:
    """
    Evaluate whether a single firewall rule matches the given prompt.

    Returns:
        True if the rule matches, otherwise False.
    """
    match rule.rule_type:
        case "keyword":
            return rule.rule_value.lower() in normalized_prompt

        case "regex":
            try:
                return bool(re.search(rule.rule_value, prompt_text, re.IGNORECASE))
            except re.error as exc:
                logger.error(
                    "Invalid regex in firewall rule %s: %s",
                    rule.rule_id,
                    exc,
                )
                return False

        case "length":
            try:
                return len(prompt_text) > int(rule.rule_value)
            except ValueError as exc:
                logger.error(
                    "Invalid length rule value for firewall rule %s: %s",
                    rule.rule_id,
                    exc,
                )
                return False

        case "system_prompt_guard":
            return rule.rule_value.lower() in normalized_prompt

        case _:
            logger.warning(
                "Unknown firewall rule type: '%s' for Rule ID %s",
                rule.rule_type,
                rule.rule_id,
            )
            return False

async def evaluate_rules(
    prompt_text: str,
    db: AsyncSession,
    org_id: str,
) -> RuleCheckResult:
    """
    Evaluate a prompt against built-in and database firewall rules.

    Validation order:
    1. Prompt length
    2. Built-in firewall patterns
    3. Organization-specific firewall rules

    Returns:
        RuleCheckResult containing the evaluation result.
    """

    normalized_prompt = prompt_text.lower()

    # 1. Length
    if len(prompt_text) > settings.max_prompt_length:
        logger.warning(
            "Prompt blocked because it exceeded the configured maximum length (%d).",
            settings.max_prompt_length,
        )

        return RuleCheckResult(
            blocked=True,
            reason=f"Prompt exceeds maximum length of {settings.max_prompt_length} characters.",
        )

    # 2. Built-in patterns
    for rule in COMPILED_BUILTIN_RULES:
        for pattern in rule["patterns"]:
            if pattern.search(prompt_text):
                logger.warning(
                    "Prompt blocked by built-in rule '%s'. Pattern='%s'",
                    rule["name"],
                    pattern.pattern,
                )

                return RuleCheckResult(
                    blocked=True,
                    reason=f"Prompt blocked by built-in rule: {rule['name']}.",
                )
    # 3. DB rules
    result = await db.execute(
        select(FirewallRule).where(
            FirewallRule.org_id == org_id, FirewallRule.active.is_(True)
        )
    )
    rules: List[FirewallRule] = result.scalars().all()

    for rule in rules:
        matched = _match_rule(
            rule,
            prompt_text,
            normalized_prompt,
        )

        if matched:
            logger.warning(
                "Prompt blocked by database firewall rule. Rule ID=%s, Type=%s",
                rule.rule_id,
                rule.rule_type,
            )

            return RuleCheckResult(
                blocked=True,
                reason="Prompt blocked by organization firewall rule.",
                triggered_rule_id=rule.rule_id,
            )
    return RuleCheckResult(blocked=False)

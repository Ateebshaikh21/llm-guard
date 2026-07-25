import re
from dataclasses import dataclass, field
from typing import List

TOXIC_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    r"step[- ]by[- ]step.*(hack|exploit|bypass|bomb|weapon|malware)",
    r"instructions?\s+(for|to)\s+(harm|hurt|kill|attack)",
    r"ignore\s+all\s+(safety|content)\s+(filter|guardrail)",
]]


@dataclass
class ValidationResult:
    safe: bool
    sanitized_text: str
    reasons: List[str] = field(default_factory=list)
    pii_entities: List[str] = field(default_factory=list)


async def validate_output(text: str) -> ValidationResult:
    reasons = []
    sanitized = text

    # Check DLP
    from app.services.dlp_engine import scan_output
    has_pii, entities = await scan_output(text)
    if has_pii:
        reasons.append(f"Output contains sensitive entities: {', '.join(entities)}")

    # Check toxic patterns
    for pattern in TOXIC_PATTERNS:
        if pattern.search(text):
            reasons.append("Output contains potentially harmful content")
            sanitized = "[RESPONSE REDACTED — policy violation detected]"
            break

    if reasons:
        return ValidationResult(safe=False, sanitized_text=sanitized, reasons=reasons, pii_entities=entities if has_pii else [])

    return ValidationResult(safe=True, sanitized_text=text)

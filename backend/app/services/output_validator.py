"""
Output Validator — LLM-Guard

Validates every LLM response before it is returned to the user.
Detection scope:
  1. PII / sensitive-data leakage  (via existing DLP engine)
  2. Toxicity / harmful content    (pattern-based)

If the validator itself raises an unexpected exception, it FAILS CLOSED:
the response is blocked and the error is logged. A validator failure must
never silently become an "allowed" response.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import List

from app.services.dlp_engine import scan_output  # module-level for test patching

logger = logging.getLogger(__name__)

# ── Toxic/harmful content patterns ─────────────────────────────────────
# Patterns cover the dangerous content without requiring the exact phrase
# "step-by-step". Each pattern is anchored to a clear harm signal.
_TOXIC_PATTERNS = [re.compile(p, re.IGNORECASE) for p in [
    # Harmful instructions — with or without "step-by-step"
    r"(step[- ]by[- ]step\s+)?(instructions?\s+(for|to|on how to)|how\s+to)\s+"
    r".{0,40}(hack|exploit|attack|bomb|explosive|weapon|poison|malware|ransomware|kill|harm|hurt)",

    # Direct "here is how to" harmful patterns
    r"here('?s|\s+is)\s+(how|the\s+way)\s+to\s+.{0,40}"
    r"(make|build|create|synthesize|construct).{0,30}(bomb|weapon|explosive|poison|drug|malware)",

    # Malicious code artefacts
    r"\b(malware|ransomware|keylogger|rootkit|backdoor|exploit)\b.{0,60}"
    r"\b(code|script|payload|snippet|example|implementation)\b",

    # Output that attempts to override safety systems
    r"ignore\s+all\s+(safety|content)\s+(filter|guardrail|polic)",

    # Chemical/biological harm synthesis
    r"(synthesize|manufacture|produce|create)\s+.{0,40}(nerve\s+agent|biological\s+weapon|chemical\s+weapon|fentanyl|meth)",

    # Credential/key exfiltration patterns in responses
    r"(here\s+(is|are)|i\s+found)\s+(your\s+)?(password|api\s+key|secret\s+key|access\s+token)[\s:]+\S+",
]]

# Safe error response returned when a toxic response is blocked
_REDACTED_RESPONSE = "[RESPONSE BLOCKED — content policy violation]"

# Safe error response returned when the validator itself fails
_VALIDATOR_FAILURE_RESPONSE = "[RESPONSE BLOCKED — output validation unavailable]"


@dataclass
class ValidationResult:
    safe: bool
    sanitized_text: str
    reasons: List[str] = field(default_factory=list)
    pii_entities: List[str] = field(default_factory=list)
    validator_error: bool = False   # True if the validator itself failed (fail-closed)


async def validate_output(text: str) -> ValidationResult:
    """
    Validate an LLM response.

    Returns a ValidationResult where:
      safe=True   → response is clean, sanitized_text == original text
      safe=False  → response must NOT be returned to the user;
                    use sanitized_text as the replacement

    On unexpected failure, returns safe=False with validator_error=True.
    The caller must treat validator_error=True as a blocked response.
    """
    try:
        return await _validate(text)
    except Exception as exc:
        logger.error("[output_validator] Unexpected validation failure: %s", exc, exc_info=True)
        return ValidationResult(
            safe=False,
            sanitized_text=_VALIDATOR_FAILURE_RESPONSE,
            reasons=["Output validator encountered an internal error"],
            validator_error=True,
        )


async def _validate(text: str) -> ValidationResult:
    reasons: List[str] = []
    sanitized = text
    entities: List[str] = []

    # ── Check 1: PII / sensitive data (reuse existing DLP engine) ──────
    try:
        has_pii, entities = await scan_output(text)
        if has_pii:
            reasons.append(f"Output contains sensitive entities: {', '.join(entities)}")
    except Exception as exc:
        logger.warning("[output_validator] DLP scan failed: %s", exc)
        # DLP failure → fail closed: treat as unsafe, replace content
        reasons.append("Output DLP scan failed — treating as unsafe")
        sanitized = _VALIDATOR_FAILURE_RESPONSE
        entities = []

    # ── Check 2: Toxic/harmful content patterns ─────────────────────────
    for pattern in _TOXIC_PATTERNS:
        if pattern.search(text):
            reasons.append("Output contains potentially harmful content")
            sanitized = _REDACTED_RESPONSE
            break

    if reasons:
        return ValidationResult(
            safe=False,
            sanitized_text=sanitized,
            reasons=reasons,
            pii_entities=entities,
        )

    return ValidationResult(safe=True, sanitized_text=text)

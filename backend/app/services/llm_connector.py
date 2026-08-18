"""LLM Connector — routes to OpenAI or Ollama."""
import logging
import ssl
from typing import List, Dict

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_ssl_context() -> ssl.SSLContext | bool:
    """
    Build an SSL context for LLM API calls.

    Production (ENVIRONMENT != 'development'):
        - Certificate verification ENABLED (default system CA bundle)
        - Returns True (httpx default — full verification)

    Development only (ENVIRONMENT == 'development' AND ALLOW_INSECURE_TLS == 'true'):
        - Verification disabled with a visible WARNING
        - This path exists ONLY for local development with SSL-intercepting proxies
        - Must NEVER be used in production

    If a custom CA bundle path is provided via LLM_CA_BUNDLE, it is used in all environments.
    """
    is_production = settings.environment.lower() not in ("development", "dev", "local")
    allow_insecure = settings.allow_insecure_tls

    if is_production and allow_insecure:
        # Production + insecure → refuse to start. Log as critical and raise.
        msg = (
            "SECURITY ERROR: ALLOW_INSECURE_TLS=true is not permitted in production "
            f"(ENVIRONMENT={settings.environment}). "
            "Fix your TLS configuration and remove ALLOW_INSECURE_TLS."
        )
        logger.critical(msg)
        raise RuntimeError(msg)

    if allow_insecure:
        logger.warning(
            "[llm_connector] TLS verification DISABLED (ALLOW_INSECURE_TLS=true). "
            "This is only safe for local development with an intercepting proxy. "
            "Do NOT use in production."
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    if settings.llm_ca_bundle:
        logger.info("[llm_connector] Using custom CA bundle: %s", settings.llm_ca_bundle)
        return ssl.create_default_context(cafile=settings.llm_ca_bundle)

    # Default: full verification using system CA bundle
    return True


async def complete(
    messages: List[Dict[str, str]],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> str:
    ssl_context = _build_ssl_context()
    if settings.llm_backend == "ollama":
        return await _ollama(messages, model, temperature, max_tokens, ssl_context)
    return await _openai(messages, model, temperature, max_tokens, ssl_context)


async def _openai(messages, model, temperature, max_tokens, ssl_context) -> str:
    if not settings.openai_api_key:
        return "[No OPENAI_API_KEY configured — set it in your .env file]"
    async with httpx.AsyncClient(timeout=90.0, verify=ssl_context) as client:
        r = await client.post(
            f"{settings.openai_base_url}/chat/completions",
            json={
                "model": model or settings.openai_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _ollama(messages, model, temperature, max_tokens, ssl_context) -> str:
    async with httpx.AsyncClient(timeout=120.0, verify=ssl_context) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={
                "model": model or settings.ollama_model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
        )
        r.raise_for_status()
        return r.json()["message"]["content"]

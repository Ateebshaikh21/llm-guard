"""LLM Connector — routes to OpenAI or Ollama."""
import httpx
from typing import List, Dict
from app.core.config import settings


async def complete(messages: List[Dict[str, str]], model: str | None = None,
                   temperature: float = 0.7, max_tokens: int = 1024) -> str:
    if settings.llm_backend == "ollama":
        return await _ollama(messages, model, temperature, max_tokens)
    return await _openai(messages, model, temperature, max_tokens)


async def _openai(messages, model, temperature, max_tokens) -> str:
    if not settings.openai_api_key:
        return "[No OPENAI_API_KEY configured — set it in your .env file]"
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(
            f"{settings.openai_base_url}/chat/completions",
            json={"model": model or settings.openai_model, "messages": messages,
                  "temperature": temperature, "max_tokens": max_tokens},
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _ollama(messages, model, temperature, max_tokens) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            f"{settings.ollama_base_url}/api/chat",
            json={"model": model or settings.ollama_model, "messages": messages,
                  "stream": False, "options": {"temperature": temperature, "num_predict": max_tokens}},
        )
        r.raise_for_status()
        return r.json()["message"]["content"]

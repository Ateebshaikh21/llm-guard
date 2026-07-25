import redis.asyncio as aioredis
from app.core.config import settings

_redis = None


async def init_redis():
    global _redis
    if not settings.redis_url:
        print("⚠️  REDIS_URL not set — rate limiting and caching disabled")
        _redis = None
        return
    try:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True, max_connections=10)
        await _redis.ping()
    except Exception as e:
        print(f"⚠️  Redis not available ({e}) — rate limiting and caching disabled")
        _redis = None


def get_redis():
    return _redis  # May be None — callers must handle

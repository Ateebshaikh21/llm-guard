from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


def _async_database_url(url: str) -> str:
    """
    Normalise a database URL for SQLAlchemy async drivers.

    Railway (and most cloud providers) give a plain postgresql:// or
    postgres:// URL. SQLAlchemy async requires the +asyncpg driver suffix.
    MySQL URLs are passed through unchanged (already use +aiomysql).
    """
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(_async_database_url(settings.database_url), echo=False)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession,
    expire_on_commit=False, autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    from app.models import user, rule, prompt_log, audit  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

# backend/app/core/database.py
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from backend.app.core.settings import settings

# ────────────────────────────────────────────────
# Async-движок MSSQL (aioodbc + ODBC 18)
# ────────────────────────────────────────────────
engine: AsyncEngine = create_async_engine(
    settings.mssql_dsn,
    echo=False,               # убирать в production, если нужен лог — ставьте True
    poolclass=NullPool,       # предотвращает «Connection is closed» при idle
    pool_pre_ping=True,       # health-чек соединений
    connect_args={"timeout": 30},  # таймаут на установку коннекта
)

async_session_factory = async_sessionmaker(
    engine,
    expire_on_commit=False,    # ORM-объекты живы после commit
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """
    DI-зависимость для FastAPI.

    Пример использования:
        @router.get("/items")
        async def list_items(session: AsyncSession = Depends(get_session)):
            ...
    """
    async with async_session_factory() as session:
        yield session

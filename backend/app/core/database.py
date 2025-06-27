from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from backend.app.core.settings import settings

engine = create_async_engine(settings.mssql_dsn, pool_pre_ping=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)
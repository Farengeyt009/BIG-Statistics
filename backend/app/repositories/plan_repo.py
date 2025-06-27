from sqlalchemy import text
from backend.app.core.database import async_session

async def ping() -> int:
    async with async_session() as s:
        res = await s.execute(text("SELECT 1"))
        return res.scalar_one()

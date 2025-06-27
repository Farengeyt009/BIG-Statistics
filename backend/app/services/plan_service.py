from backend.app.repositories.plan_repo import ping
async def db_health() -> bool:
    return await ping() == 1

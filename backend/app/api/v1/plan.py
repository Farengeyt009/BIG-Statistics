from fastapi import APIRouter, HTTPException
from backend.app.services.plan_service import db_health

router = APIRouter(tags=["plan"])

@router.get("/db-health")
async def db_health_endpoint():
    if await db_health():
        return {"db": "ok"}
    raise HTTPException(503, "DB unavailable")

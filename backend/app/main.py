# backend/app/main.py
from fastapi import FastAPI

# если роутер ещё не готов, временно закомментируйте следующую строку
# from backend.app.api.v1.plan import router as plan_router

app = FastAPI(title="BIG STATISTICS API")

@app.get("/healthz")
async def health() -> dict[str, str]:
    return {"status": "ok"}

# app.include_router(plan_router, prefix="/api/v1")  # раскомментируйте, когда файл plan.py готов

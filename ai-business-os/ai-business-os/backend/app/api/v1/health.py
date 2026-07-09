"""Liveness & readiness probes."""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.schemas.response import ApiResponse

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness probe")
async def health() -> ApiResponse[dict]:
    return ApiResponse.ok(
        data={"status": "ok", "environment": settings.ENVIRONMENT},
        message="Service is healthy.",
    )


@router.get("/ready", summary="Readiness probe (checks database)")
async def ready(db: AsyncSession = Depends(get_db)) -> ApiResponse[dict]:
    await db.execute(text("SELECT 1"))
    return ApiResponse.ok(data={"database": "ok"}, message="Service is ready.")

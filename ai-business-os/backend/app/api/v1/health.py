"""Liveness & readiness probes."""
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.core.config import settings
from app.db.session import get_db
from app.schemas.response import ApiResponse

router = APIRouter(tags=["Health"])
logger = structlog.get_logger("health")


@router.get("/health", summary="Liveness probe")
async def health() -> ApiResponse[dict]:
    return ApiResponse.ok(
        data={"status": "ok", "environment": settings.ENVIRONMENT},
        message="Service is healthy.",
    )


@router.get(
    "/ready",
    summary="Readiness probe (checks database)",
    response_model=ApiResponse[dict],
)
async def ready(db: AsyncSession = Depends(get_db)) -> Any:
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("database_readiness_failed", error=str(exc))
        return JSONResponse(
            status_code=503,
            content=ApiResponse.fail(
                message="Service is not ready.",
                errors=[{"code": "database_unavailable"}],
            ).model_dump(),
        )
    return ApiResponse.ok(data={"database": "ok"}, message="Service is ready.")

"""Finance API router aggregate — Part 08.2 Invoices."""

from fastapi import APIRouter

from app.api.v1.finance import invoices

router = APIRouter(prefix="/finance", tags=["Finance"])
router.include_router(invoices.router)

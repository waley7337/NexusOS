"""Finance API router aggregate — invoices, payments, expenses, checkout."""

from fastapi import APIRouter

from app.api.v1.finance import checkout, expenses, invoices, payment_providers, payments

router = APIRouter(prefix="/finance", tags=["Finance"])
router.include_router(invoices.router)
router.include_router(payments.router)
router.include_router(checkout.router)
router.include_router(payment_providers.router)
router.include_router(expenses.router)

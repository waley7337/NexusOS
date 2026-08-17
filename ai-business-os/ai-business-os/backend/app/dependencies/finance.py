"""Finance FastAPI dependency helpers — trusted tenant context → repositories."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.repositories.finance import InvoiceRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_invoice_repository(
    db: DbSession,
    user: ActiveUser,
) -> InvoiceRepository:
    return InvoiceRepository(db, company_id=user.company_id, user_id=user.id)


InvoiceRepo = Annotated[InvoiceRepository, Depends(get_invoice_repository)]

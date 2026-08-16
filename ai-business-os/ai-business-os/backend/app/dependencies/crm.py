"""CRM FastAPI dependency helpers — trusted tenant context → repositories.

Repositories always receive `company_id` / `user_id` from
`get_current_active_user` (DB-derived), never from the request body or
query string.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import CurrentUser, get_current_active_user
from app.db.session import get_db
from app.repositories.crm import (
    ContactRepository,
    CustomerRepository,
    DealRepository,
    LeadRepository,
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_customer_repository(
    db: DbSession,
    user: ActiveUser,
) -> CustomerRepository:
    return CustomerRepository(db, company_id=user.company_id, user_id=user.id)


def get_contact_repository(
    db: DbSession,
    user: ActiveUser,
) -> ContactRepository:
    return ContactRepository(db, company_id=user.company_id, user_id=user.id)


def get_lead_repository(
    db: DbSession,
    user: ActiveUser,
) -> LeadRepository:
    return LeadRepository(db, company_id=user.company_id, user_id=user.id)


def get_deal_repository(
    db: DbSession,
    user: ActiveUser,
) -> DealRepository:
    return DealRepository(db, company_id=user.company_id, user_id=user.id)


CustomerRepo = Annotated[CustomerRepository, Depends(get_customer_repository)]
ContactRepo = Annotated[ContactRepository, Depends(get_contact_repository)]
LeadRepo = Annotated[LeadRepository, Depends(get_lead_repository)]
DealRepo = Annotated[DealRepository, Depends(get_deal_repository)]

"""CRM API router aggregate.

Service-layer decision (06.1): simple CRM CRUD uses
router → repository (via dependencies.crm). Introduce CRM services only
when multi-step workflows appear (e.g. lead→deal conversion).

Part 06.2 Customers · Part 06.4 Contacts. Leads / Deals mount later.
"""

from fastapi import APIRouter

from app.api.v1.crm import contacts, customers

router = APIRouter(prefix="/crm", tags=["CRM"])
router.include_router(customers.router)
router.include_router(contacts.router)

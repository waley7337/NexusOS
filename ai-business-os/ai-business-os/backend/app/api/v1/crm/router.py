"""CRM API router aggregate.

Service-layer decision (06.1): simple CRM CRUD uses
router → repository (via dependencies.crm). Introduce CRM services only
when multi-step workflows appear (e.g. lead→deal conversion).

Part 06.2 Customers · 06.4 Contacts · 06.6 Leads. Deals mount later.
"""

from fastapi import APIRouter

from app.api.v1.crm import contacts, customers, leads

router = APIRouter(prefix="/crm", tags=["CRM"])
router.include_router(customers.router)
router.include_router(contacts.router)
router.include_router(leads.router)

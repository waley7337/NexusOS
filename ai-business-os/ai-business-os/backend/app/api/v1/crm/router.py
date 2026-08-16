"""CRM API router aggregate.

Service-layer decision (06.1): simple CRM CRUD uses
router → repository (via dependencies.crm). Introduce CRM services only
when multi-step workflows appear (e.g. lead→deal conversion).

Part 06.2 adds Customers. Contacts / Leads / Deals mount here in later
phases — keep this file as the aggregation point only.
"""

from fastapi import APIRouter

from app.api.v1.crm import customers

router = APIRouter(prefix="/crm", tags=["CRM"])
router.include_router(customers.router)

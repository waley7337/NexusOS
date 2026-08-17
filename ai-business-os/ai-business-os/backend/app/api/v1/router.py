"""API v1 root router.

Each module registers its own router here. Modules never import each
other's routers — this file is the only aggregation point.
"""
from fastapi import APIRouter

from app.api.v1 import auth, health
from app.api.v1.crm import router as crm_router
from app.api.v1.finance import router as finance_router
from app.api.v1.hr import router as hr_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth")
# CRM (06.2–06.9) — Customers, Contacts, Leads, Deals, Customer Notes.
api_router.include_router(crm_router)
# HR (07.2) — Employees.
api_router.include_router(hr_router)
# Finance (08.2) — Invoices.
api_router.include_router(finance_router)


# Module routers land here as they're built (Parts 3+):
# api_router.include_router(companies.router, prefix="/companies", tags=["Companies"])
# api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])

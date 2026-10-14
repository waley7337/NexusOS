"""API v1 root router.

Each module registers its own router here. Modules never import each
other's routers — this file is the only aggregation point.
"""
from fastapi import APIRouter

from app.api.v1 import auth, health
from app.api.v1.crm import router as crm_router
from app.api.v1.finance import router as finance_router
from app.api.v1.hr import router as hr_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router, prefix="/auth")
# CRM (06.2–06.9) — Customers, Contacts, Leads, Deals, Customer Notes.
api_router.include_router(crm_router)
# HR (07.2) — Employees.
api_router.include_router(hr_router)
# Finance (08.2) — Invoices + Payments.
api_router.include_router(finance_router)
# Inventory (08.3) — Products, Warehouses, Stock Levels.
api_router.include_router(inventory_router)
# Projects + Tasks (08.4).
api_router.include_router(projects_router)
# Settings — company profile PATCH.
from app.api.v1 import settings as settings_module  # noqa: E402
api_router.include_router(settings_module.router)
# Reports — aggregations across modules.
from app.api.v1 import reports as reports_module  # noqa: E402
api_router.include_router(reports_module.router)
# AI Assistant — conversational assistant backed by OpenAI.
from app.api.v1 import assistant as assistant_module  # noqa: E402
api_router.include_router(assistant_module.router)
# Dashboard metrics — tenant-scoped operational KPIs.
from app.api.v1 import dashboard as dashboard_module  # noqa: E402
api_router.include_router(dashboard_module.router)
# In-app notifications — current-user inbox.
from app.api.v1 import notifications as notifications_module  # noqa: E402
api_router.include_router(notifications_module.router)
# Platform SaaS billing (NexusOS subscription — separate from tenant invoice payments).
from app.api.v1 import billing as billing_module  # noqa: E402
api_router.include_router(billing_module.router)
# Stripe webhooks (signature-verified; unauthenticated).
from app.api.v1.webhooks import stripe as stripe_webhooks  # noqa: E402
api_router.include_router(stripe_webhooks.router)

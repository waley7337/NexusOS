"""API v1 root router.

Each module registers its own router here. Modules never import each
other's routers — this file is the only aggregation point.
"""
from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)

# Module routers land here as they're built (Parts 3+):
# api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
# api_router.include_router(companies.router, prefix="/companies", tags=["Companies"])
# api_router.include_router(crm.router, prefix="/crm", tags=["CRM"])
# api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])

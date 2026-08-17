"""HR API router aggregate — Part 07.2 Employees."""

from fastapi import APIRouter

from app.api.v1.hr import employees

router = APIRouter(prefix="/hr", tags=["HR"])
router.include_router(employees.router)

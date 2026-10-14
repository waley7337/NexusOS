"""HR API router aggregate — Employees, Leave, Attendance."""

from fastapi import APIRouter

from app.api.v1.hr import attendance, employees, leave_requests

router = APIRouter(prefix="/hr", tags=["HR"])
router.include_router(employees.router)
router.include_router(leave_requests.router)
router.include_router(attendance.router)

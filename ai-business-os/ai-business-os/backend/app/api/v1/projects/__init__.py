"""Projects + Tasks API router package (Part 08.4)."""
from fastapi import APIRouter

from app.api.v1.projects import projects, tasks

router = APIRouter()
router.include_router(projects.router)
router.include_router(tasks.router)

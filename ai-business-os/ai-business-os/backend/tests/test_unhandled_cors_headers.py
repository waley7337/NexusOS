"""Unhandled 500 responses must still carry CORS for allowlisted origins.

ServerErrorMiddleware serves Exception handlers outside CORSMiddleware, so
browsers otherwise report opaque Axios "Network Error" for real 500s.
"""

from __future__ import annotations

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


def test_unhandled_exception_includes_cors_for_allowlisted_origin(monkeypatch):
    monkeypatch.setattr(
        settings,
        "CORS_ORIGINS",
        ["http://localhost:5173", "https://app.example.com"],
        raising=False,
    )
    app = create_app()
    boom = APIRouter()

    @boom.get("/__test_unhandled_boom")
    async def _boom() -> None:
        raise RuntimeError("intentional boom for cors regression")

    app.include_router(boom, prefix="/api/v1")

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.get(
            "/api/v1/__test_unhandled_boom",
            headers={"Origin": "https://app.example.com"},
        )

    assert res.status_code == 500
    assert res.headers.get("access-control-allow-origin") == "https://app.example.com"
    assert res.headers.get("access-control-allow-credentials") == "true"
    body = res.json()
    assert body["success"] is False
    assert body["errors"][0]["code"] == "internal_error"


def test_unhandled_exception_omits_cors_for_unknown_origin(monkeypatch):
    monkeypatch.setattr(
        settings,
        "CORS_ORIGINS",
        ["http://localhost:5173"],
        raising=False,
    )
    app = create_app()
    boom = APIRouter()

    @boom.get("/__test_unhandled_boom2")
    async def _boom() -> None:
        raise RuntimeError("intentional boom for cors regression")

    app.include_router(boom, prefix="/api/v1")

    with TestClient(app, raise_server_exceptions=False) as client:
        res = client.get(
            "/api/v1/__test_unhandled_boom2",
            headers={"Origin": "https://evil.example"},
        )

    assert res.status_code == 500
    assert res.headers.get("access-control-allow-origin") is None

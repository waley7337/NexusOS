"""Transport-level regression tests for the PB.1 authority boundary."""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-platform-billing-authority")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus",
)

from fastapi.testclient import TestClient

from app.main import create_app
from app.repositories.platform_billing import PlatformBillingProfileRepository


def test_billing_profile_invariant_response_does_not_expose_company_id():
    app = create_app()
    internal_company_id = str(uuid.uuid4())

    class MissingProfileResult:
        def scalar_one_or_none(self):
            return None

    class MissingProfileSession:
        async def execute(self, statement):
            return MissingProfileResult()

    @app.get("/_test/billing-profile-invariant")
    async def raise_invariant_error():
        return await PlatformBillingProfileRepository(
            MissingProfileSession(),  # type: ignore[arg-type]
            company_id=uuid.UUID(internal_company_id),
        ).get_authoritative()

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/_test/billing-profile-invariant")

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "data": None,
        "message": "Company billing profile is not provisioned.",
        "errors": [{"code": "billing_profile_invariant"}],
    }
    assert internal_company_id not in response.text

"""Unit tests for Stripe Connect onboarding (Accounts v2 create path)."""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.exceptions import ConflictError, ServiceUnavailableError, ValidationError
from app.models.enums import ProviderConnectionStatus
from app.payments.tenant.connect_service import (
    TenantConnectService,
    _extract_connected_account_id,
    _raise_connect_create_failure,
)


def test_map_connect_not_enabled_error():
    with pytest.raises(ServiceUnavailableError) as exc:
        _raise_connect_create_failure(
            company_id=uuid.uuid4(),
            exc=RuntimeError(
                "You can only create new accounts if you've signed up for Connect"
            ),
        )
    assert exc.value.details["reason"] == "stripe_connect_platform_not_enabled"


def test_map_platform_profile_incomplete_error():
    err = SimpleNamespace(
        code="account_creation_liability_unacknowledged",
        user_message="Please review the responsibilities of managing losses",
    )
    with pytest.raises(ServiceUnavailableError) as exc:
        _raise_connect_create_failure(company_id=uuid.uuid4(), exc=err)  # type: ignore[arg-type]
    assert exc.value.details["reason"] == "stripe_connect_platform_profile_incomplete"


def test_map_generic_create_failure():
    with pytest.raises(ConflictError) as exc:
        _raise_connect_create_failure(
            company_id=uuid.uuid4(),
            exc=RuntimeError("something else failed"),
        )
    assert exc.value.details["reason"] == "stripe_connect_account_create_failed"


def test_extract_account_id_from_dict_and_stripe_response():
    assert _extract_connected_account_id({"id": "acct_abc"}) == "acct_abc"
    assert _extract_connected_account_id(SimpleNamespace(data={"id": "acct_xyz"})) == "acct_xyz"
    assert _extract_connected_account_id(SimpleNamespace(id="acct_direct")) == "acct_direct"
    assert _extract_connected_account_id({"id": "cus_nope"}) is None
    assert _extract_connected_account_id(SimpleNamespace(data={})) is None


@pytest.mark.asyncio
async def test_start_onboarding_creates_v2_account_and_link(monkeypatch):
    monkeypatch.setattr(
        "app.payments.tenant.connect_service.require_tenant_payments_enabled",
        lambda: "sk_test_x",
    )
    monkeypatch.setattr(
        "app.payments.tenant.connect_service.settings.FRONTEND_URL",
        "https://nexuops.com",
    )

    company_id = uuid.uuid4()
    user_id = uuid.uuid4()
    account_row = SimpleNamespace(
        id=uuid.uuid4(),
        external_account_id="acct_new123",
        connection_status=ProviderConnectionStatus.ONBOARDING,
        charges_enabled=False,
        payouts_enabled=False,
    )

    db = MagicMock()

    async def _execute(stmt):  # noqa: ARG001
        # First call user, second company — return objects with email/name.
        # SQLAlchemy select identity is opaque; return based on call order.
        if not hasattr(_execute, "n"):
            _execute.n = 0
        _execute.n += 1
        if _execute.n == 1:
            return SimpleNamespace(
                scalar_one_or_none=lambda: SimpleNamespace(email="owner@example.com")
            )
        return SimpleNamespace(
            scalar_one_or_none=lambda: SimpleNamespace(
                email="billing@example.com", name="Acme Co"
            )
        )

    db.execute = _execute

    service = TenantConnectService(db, company_id=company_id, user_id=user_id)
    service.repo.get_active_stripe = AsyncMock(return_value=None)  # type: ignore[method-assign]
    service.repo.upsert_pending_stripe = AsyncMock(return_value=account_row)  # type: ignore[method-assign]

    client = MagicMock()
    client.raw_request.return_value = {"id": "acct_new123"}
    stripe_mod = MagicMock()
    stripe_mod.AccountLink.create.return_value = {
        "url": "https://connect.stripe.com/setup/e/test_link"
    }

    with (
        patch(
            "app.payments.tenant.connect_service.stripe_client",
            return_value=client,
        ),
        patch(
            "app.payments.tenant.connect_service.stripe_module",
            return_value=stripe_mod,
        ),
    ):
        link = await service.start_onboarding()

    assert link.onboarding_url.startswith("https://connect.stripe.com/")
    assert link.external_account_id == "acct_new123"
    client.raw_request.assert_called_once()
    args, kwargs = client.raw_request.call_args
    assert args[0] == "post"
    assert args[1] == "/v2/core/accounts"
    assert kwargs["dashboard"] == "express"
    assert kwargs["contact_email"] == "owner@example.com"
    assert kwargs["display_name"] == "Acme Co"
    assert kwargs["idempotency_key"] == f"connect-account:{company_id}"
    assert kwargs["configuration"]["merchant"]["capabilities"]["card_payments"]["requested"] is True
    stripe_mod.AccountLink.create.assert_called_once()
    service.repo.upsert_pending_stripe.assert_awaited_once_with(
        external_account_id="acct_new123"
    )


@pytest.mark.asyncio
async def test_start_onboarding_requires_contact_email(monkeypatch):
    monkeypatch.setattr(
        "app.payments.tenant.connect_service.require_tenant_payments_enabled",
        lambda: "sk_test_x",
    )
    db = MagicMock()

    async def _execute(_stmt):
        return SimpleNamespace(scalar_one_or_none=lambda: SimpleNamespace(email=None, name="X"))

    db.execute = _execute
    service = TenantConnectService(db, company_id=uuid.uuid4(), user_id=uuid.uuid4())
    service.repo.get_active_stripe = AsyncMock(return_value=None)  # type: ignore[method-assign]

    with (
        patch("app.payments.tenant.connect_service.stripe_module", return_value=MagicMock()),
        pytest.raises(ValidationError) as exc,
    ):
        await service.start_onboarding()
    assert exc.value.details["reason"] == "connect_contact_email_missing"


@pytest.mark.asyncio
async def test_start_onboarding_reuses_existing_account(monkeypatch):
    monkeypatch.setattr(
        "app.payments.tenant.connect_service.require_tenant_payments_enabled",
        lambda: "sk_test_x",
    )
    monkeypatch.setattr(
        "app.payments.tenant.connect_service.settings.FRONTEND_URL",
        "https://nexuops.com",
    )
    existing = SimpleNamespace(
        id=uuid.uuid4(),
        external_account_id="acct_existing",
        connection_status=ProviderConnectionStatus.ONBOARDING,
        charges_enabled=False,
        payouts_enabled=False,
    )
    db = MagicMock()
    service = TenantConnectService(db, company_id=uuid.uuid4(), user_id=uuid.uuid4())
    service.repo.get_active_stripe = AsyncMock(return_value=existing)  # type: ignore[method-assign]

    stripe_mod = MagicMock()
    stripe_mod.AccountLink.create.return_value = SimpleNamespace(
        url="https://connect.stripe.com/setup/e/continue"
    )
    with (
        patch("app.payments.tenant.connect_service.stripe_client") as client_factory,
        patch(
            "app.payments.tenant.connect_service.stripe_module",
            return_value=stripe_mod,
        ),
    ):
        link = await service.start_onboarding()

    client_factory.assert_not_called()
    assert link.external_account_id == "acct_existing"
    assert "connect.stripe.com" in link.onboarding_url

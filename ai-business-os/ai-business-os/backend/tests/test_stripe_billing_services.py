"""Unit tests for Stripe tenant checkout + platform billing (mocked Stripe)."""
from __future__ import annotations

import uuid
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.exceptions import ConflictError, ServiceUnavailableError, ValidationError
from app.models.enums import PlatformPlan, PlatformSubscriptionStatus
from app.payments.platform.billing_service import PlatformBillingService
from app.payments.stripe_config import (
    billing_live,
    price_id_for_plan,
    require_billing_enabled,
    require_tenant_payments_enabled,
    tenant_payments_live,
)
from app.payments.tenant.checkout_service import TenantInvoiceCheckoutService


def test_fail_closed_when_tenant_payments_disabled(monkeypatch):
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_TENANT_PAYMENTS_ENABLED", False)
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_PLATFORM_SECRET_KEY", None)
    assert tenant_payments_live() is False
    with pytest.raises(ServiceUnavailableError) as exc:
        require_tenant_payments_enabled()
    assert exc.value.details["reason"] == "stripe_tenant_payments_disabled"


def test_fail_closed_when_billing_credentials_missing(monkeypatch):
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_BILLING_ENABLED", True)
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_PLATFORM_SECRET_KEY", None)
    assert billing_live() is False
    with pytest.raises(ServiceUnavailableError) as exc:
        require_billing_enabled()
    assert exc.value.details["reason"] == "stripe_credentials_missing"


def test_price_id_mapping_is_server_controlled(monkeypatch):
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_PRICE_STARTER", "price_starter_test")
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_PRICE_PRO", None)
    assert price_id_for_plan(PlatformPlan.STARTER) == "price_starter_test"
    with pytest.raises(ServiceUnavailableError):
        price_id_for_plan(PlatformPlan.PRO)
    with pytest.raises(ValidationError):
        price_id_for_plan(PlatformPlan.FREE)


@pytest.mark.asyncio
async def test_checkout_rejects_without_chargeable_connect(monkeypatch):
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_TENANT_PAYMENTS_ENABLED", True)
    monkeypatch.setattr(
        "app.payments.stripe_config.settings.STRIPE_PLATFORM_SECRET_KEY",
        SimpleNamespace(get_secret_value=lambda: "sk_test_x"),
    )

    db = MagicMock()
    service = TenantInvoiceCheckoutService(
        db, company_id=uuid.uuid4(), user_id=uuid.uuid4()
    )

    async def _not_ready():
        raise ConflictError(
            "Stripe Connect is not ready to accept invoice payments.",
            details={"reason": "stripe_connect_not_ready"},
        )

    service.providers.require_chargeable_stripe = _not_ready  # type: ignore[method-assign]

    with pytest.raises(ConflictError) as exc:
        await service.create_checkout(invoice_id=uuid.uuid4(), idempotency_key="k1")
    assert exc.value.details["reason"] == "stripe_connect_not_ready"


@pytest.mark.asyncio
async def test_platform_entitlement_gate():
    db = MagicMock()
    service = PlatformBillingService(db, company_id=uuid.uuid4())
    profile = SimpleNamespace(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.PAST_DUE,
    )
    assert service.is_entitled(profile) is False
    with pytest.raises(ConflictError) as exc:
        service.require_entitlement(profile)
    assert exc.value.details["reason"] == "subscription_not_entitled"

    profile.status = PlatformSubscriptionStatus.ACTIVE
    assert service.is_entitled(profile) is True
    with pytest.raises(ConflictError) as exc:
        service.require_entitlement(profile, minimum_plan=PlatformPlan.PRO)
    assert exc.value.details["reason"] == "plan_insufficient"


@pytest.mark.asyncio
async def test_confirm_provider_payment_amount_must_match():
    from app.services.payment_service import PaymentService

    invoice_id = uuid.uuid4()
    payment_id = uuid.uuid4()
    invoice = SimpleNamespace(
        id=invoice_id,
        total=Decimal("100.00"),
        currency="USD",
        status="sent",
        due_date=None,
    )
    payment = SimpleNamespace(
        id=payment_id,
        invoice_id=invoice_id,
        amount=Decimal("40.00"),
        currency="USD",
        status=__import__("app.models.enums", fromlist=["PaymentStatus"]).PaymentStatus.PENDING,
        source=__import__("app.models.enums", fromlist=["PaymentSource"]).PaymentSource.PROVIDER,
        provider_payment_id=None,
        provider_checkout_session_id=None,
        failure_code=None,
        failure_message=None,
        confirmed_at=None,
        confirmed_by=None,
        updated_by=None,
        refunded_amount=Decimal("0.00"),
    )

    repo = MagicMock()

    async def lock_invoice(_id):
        return invoice

    async def payment_invoice_id(_id):
        return invoice_id

    async def lock_payment(_pid, _iid):
        return payment

    async def active_payments(_iid):
        return [payment]

    async def flush():
        return None

    async def refresh(_p):
        return None

    repo.lock_invoice = lock_invoice
    repo.payment_invoice_id = payment_invoice_id
    repo.lock_payment = lock_payment
    repo.active_payments = active_payments
    repo.flush = flush
    repo.refresh = refresh
    repo.user_id = None
    repo.company_timezone = MagicMock(return_value="UTC")

    async def company_timezone():
        return "UTC"

    repo.company_timezone = company_timezone

    authority = PaymentService(repo)
    with pytest.raises(ConflictError) as exc:
        await authority.confirm_provider_payment(
            payment_id=payment_id,
            amount=Decimal("50.00"),
            currency="USD",
            provider_payment_id="pi_1",
        )
    assert exc.value.details["reason"] == "payment_amount_mismatch"


def test_to_minor_units_zero_decimal():
    from app.payments.money import from_minor_units, to_minor_units

    assert to_minor_units(Decimal("12.00"), "USD") == 1200
    assert from_minor_units(1200, "USD") == Decimal("12.00")
    assert to_minor_units(Decimal("100.00"), "JPY") == 100
    assert from_minor_units(100, "JPY") == Decimal("100.00")


@pytest.mark.asyncio
async def test_fail_provider_payment_is_noop_when_already_completed():
    """Late expiry/failure webhooks must not 409 after confirmation (Stripe retries)."""
    from app.models.enums import PaymentStatus
    from app.services.payment_service import PaymentService

    payment_id = uuid.uuid4()
    payment = SimpleNamespace(
        id=payment_id,
        status=PaymentStatus.COMPLETED,
        failure_code=None,
        failure_message=None,
        updated_by=None,
    )
    repo = MagicMock()
    repo.user_id = None

    async def lock_payment_by_id(_pid):
        return payment

    async def flush():
        return None

    repo.lock_payment_by_id = lock_payment_by_id
    repo.flush = flush
    authority = PaymentService(repo)
    result = await authority.fail_provider_payment(
        payment_id=payment_id,
        failure_code="checkout_failed",
        failure_message="expired",
    )
    assert result.status == PaymentStatus.COMPLETED
    assert result.failure_code is None


@pytest.mark.asyncio
async def test_subscription_snapshot_ignores_delayed_active_after_cancel():
    from app.payments.platform.billing_service import PlatformBillingService

    company_id = uuid.uuid4()
    profile = SimpleNamespace(
        plan=PlatformPlan.FREE,
        status=PlatformSubscriptionStatus.CANCELED,
        stripe_subscription_id="sub_old",
        stripe_customer_id="cus_1",
        stripe_price_id="price_1",
        cancel_at_period_end=False,
        current_period_start=None,
        current_period_end=None,
        canceled_at=None,
        trial_ends_at=None,
        last_synced_at=None,
        last_webhook_event_id=None,
    )
    db = MagicMock()

    async def flush():
        return None

    db.flush = flush
    service = PlatformBillingService(db, company_id=company_id)

    async def get_authoritative():
        return profile

    service.repo.get_authoritative = get_authoritative  # type: ignore[method-assign]
    result = await service.apply_subscription_snapshot(
        {
            "id": "sub_old",
            "status": "active",
            "customer": "cus_1",
            "items": {"data": [{"price": {"id": "price_1"}}]},
        },
        event_id="evt_delayed_active",
    )
    assert result.status == PlatformSubscriptionStatus.CANCELED
    assert result.plan == PlatformPlan.FREE
    assert result.last_webhook_event_id is None


@pytest.mark.asyncio
async def test_subscription_snapshot_ignores_other_subscription_id():
    from app.payments.platform.billing_service import PlatformBillingService

    company_id = uuid.uuid4()
    profile = SimpleNamespace(
        plan=PlatformPlan.PRO,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_current",
        stripe_customer_id="cus_1",
        stripe_price_id="price_pro",
        cancel_at_period_end=False,
        current_period_start=None,
        current_period_end=None,
        canceled_at=None,
        trial_ends_at=None,
        last_synced_at=None,
        last_webhook_event_id=None,
    )
    db = MagicMock()

    async def flush():
        return None

    db.flush = flush
    service = PlatformBillingService(db, company_id=company_id)

    async def get_authoritative():
        return profile

    service.repo.get_authoritative = get_authoritative  # type: ignore[method-assign]
    result = await service.apply_subscription_snapshot(
        {"id": "sub_stale", "status": "canceled", "customer": "cus_1"},
        event_id="evt_stale",
    )
    assert result.status == PlatformSubscriptionStatus.ACTIVE
    assert result.stripe_subscription_id == "sub_current"


@pytest.mark.asyncio
async def test_invoice_payment_failed_does_not_mutate_canceled_subscription():
    from app.payments.platform import webhook_handlers as handlers

    company_id = uuid.uuid4()
    profile = SimpleNamespace(
        status=PlatformSubscriptionStatus.CANCELED,
        last_webhook_event_id=None,
    )
    db = MagicMock()

    async def company_from_invoice(_db, _obj):
        return company_id

    class FakeBilling:
        def __init__(self, *_a, **_k):
            pass

        async def get_profile(self):
            return profile

    monkey_company = patch.object(handlers, "_company_from_invoice", company_from_invoice)
    monkey_billing = patch.object(handlers, "PlatformBillingService", FakeBilling)
    with monkey_company, monkey_billing:
        returned = await handlers._dispatch(
            db,
            "invoice.payment_failed",
            {"data": {"object": {"subscription": "sub_1", "customer": "cus_1"}}},
            event_id="evt_fail_after_cancel",
        )
    assert returned == company_id
    assert profile.status == PlatformSubscriptionStatus.CANCELED
    assert profile.last_webhook_event_id is None


@pytest.mark.asyncio
async def test_connect_account_mismatch_rejects_confirmation():
    from app.core.exceptions import ConflictError
    from app.payments.tenant import webhook_handlers as handlers

    payment = SimpleNamespace(
        id=uuid.uuid4(),
        company_id=uuid.uuid4(),
        provider_account_id=uuid.uuid4(),
    )
    account = SimpleNamespace(
        id=payment.provider_account_id,
        company_id=payment.company_id,
        external_account_id="acct_correct",
    )

    class Result:
        def scalar_one_or_none(self):
            return account

    class FakeDb:
        async def execute(self, _stmt):
            return Result()

    with pytest.raises(ConflictError) as exc:
        await handlers._assert_connect_account_matches(
            FakeDb(),  # type: ignore[arg-type]
            payment=payment,
            connected_account_id="acct_attacker",
        )
    assert exc.value.details["reason"] == "webhook_connect_account_mismatch"


@pytest.mark.asyncio
async def test_tenant_dispatch_ignores_platform_billing_domain():
    from app.payments.tenant import webhook_handlers as handlers

    db = MagicMock()
    company_id = await handlers._dispatch(
        db,
        "checkout.session.completed",
        {
            "data": {
                "object": {
                    "metadata": {
                        "domain": "platform_billing",
                        "company_id": str(uuid.uuid4()),
                    },
                    "mode": "subscription",
                }
            }
        },
        connected_account_id="acct_1",
    )
    assert company_id is None

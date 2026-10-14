"""Single-subscription guarantees for NexusOS SaaS billing (mocked Stripe only)."""
from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.core.exceptions import ConflictError
from app.models.enums import PlatformPlan, PlatformSubscriptionStatus
from app.payments.platform.billing_service import PlatformBillingService


def _enable_billing(monkeypatch) -> None:
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_BILLING_ENABLED", True)
    monkeypatch.setattr(
        "app.payments.stripe_config.settings.STRIPE_PLATFORM_SECRET_KEY",
        SimpleNamespace(get_secret_value=lambda: "sk_test_mock"),
    )
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_PRICE_STARTER", "price_starter")
    monkeypatch.setattr("app.payments.stripe_config.settings.STRIPE_PRICE_PRO", "price_pro")
    monkeypatch.setattr(
        "app.payments.stripe_config.settings.STRIPE_PRICE_ENTERPRISE", "price_enterprise"
    )
    monkeypatch.setattr(
        "app.payments.platform.billing_service.settings.FRONTEND_URL",
        "https://app.example.test",
    )


def _profile(**overrides):
    base = dict(
        plan=PlatformPlan.FREE,
        status=PlatformSubscriptionStatus.NO_SUBSCRIPTION,
        stripe_subscription_id=None,
        stripe_customer_id=None,
        stripe_price_id=None,
        cancel_at_period_end=False,
        current_period_start=None,
        current_period_end=None,
        canceled_at=None,
        trial_ends_at=None,
        last_synced_at=None,
        last_webhook_event_id=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _service(profile, company_id: uuid.UUID | None = None):
    company_id = company_id or uuid.uuid4()
    db = MagicMock()

    async def flush():
        return None

    async def commit():
        return None

    db.flush = flush
    db.commit = commit
    service = PlatformBillingService(db, company_id=company_id)

    async def get_authoritative():
        return profile

    async def get_authoritative_for_update():
        return profile

    service.repo.get_authoritative = get_authoritative  # type: ignore[method-assign]
    service.repo.get_authoritative_for_update = get_authoritative_for_update  # type: ignore[method-assign]
    return service, company_id


def _stripe_mock(
    *,
    session_create=None,
    customer_create=None,
    subscription_retrieve=None,
    subscription_modify=None,
):
    stripe = MagicMock()
    stripe.Customer.create = customer_create or MagicMock(return_value={"id": "cus_new"})
    stripe.checkout.Session.create = session_create or MagicMock(
        return_value={"id": "cs_1", "url": "https://checkout.stripe.test/cs_1"}
    )
    stripe.Subscription.retrieve = subscription_retrieve or MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_starter"}}]},
        }
    )
    stripe.Subscription.modify = subscription_modify or MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }
    )
    return stripe


@pytest.mark.asyncio
async def test_first_subscription_checkout_ok(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile()
    service, _ = _service(profile)
    session_create = MagicMock(
        return_value={"id": "cs_first", "url": "https://checkout.stripe.test/cs_first"}
    )
    stripe = _stripe_mock(session_create=session_create)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="idem-first")

    assert result.mode == "checkout"
    assert result.checkout_session_id == "cs_first"
    assert result.checkout_url and result.checkout_url.startswith("https://checkout.stripe.test/")
    session_create.assert_called_once()
    stripe.Subscription.modify.assert_not_called()


@pytest.mark.asyncio
async def test_active_same_plan_cannot_create_second(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="idem-dup")

    assert exc.value.details["reason"] == "subscription_already_active"
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_upgrade_updates_existing_subscription_without_second_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, company_id = _service(profile)
    modify = MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }
    )
    stripe = _stripe_mock(subscription_modify=modify)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-upgrade")

    assert result.mode == "subscription_updated"
    assert result.checkout_url is None
    assert result.checkout_session_id is None
    assert result.plan == PlatformPlan.PRO
    stripe.checkout.Session.create.assert_not_called()
    modify.assert_called_once()
    kwargs = modify.call_args.kwargs
    assert kwargs["items"] == [{"id": "si_1", "price": "price_pro"}]
    assert kwargs["proration_behavior"] == "create_prorations"
    assert kwargs["idempotency_key"] == "idem-upgrade"
    assert profile.stripe_subscription_id == "sub_1"
    assert profile.stripe_customer_id == "cus_1"
    assert profile.plan == PlatformPlan.PRO
    assert profile.status == PlatformSubscriptionStatus.ACTIVE
    assert str(company_id) in str(kwargs["metadata"])


@pytest.mark.asyncio
async def test_same_idempotency_key_does_not_create_duplicate_subscription(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(stripe_customer_id="cus_1")
    service, _ = _service(profile)
    session_create = MagicMock(
        return_value={"id": "cs_same", "url": "https://checkout.stripe.test/cs_same"}
    )
    stripe = _stripe_mock(session_create=session_create)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        first = await service.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="same-key")
        second = await service.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="same-key")

    assert first.checkout_session_id == second.checkout_session_id == "cs_same"
    assert session_create.call_count == 2
    assert all(c.kwargs["idempotency_key"] == "same-key" for c in session_create.call_args_list)
    stripe.Subscription.modify.assert_not_called()


@pytest.mark.asyncio
async def test_different_idempotency_keys_cannot_bypass_to_second_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="key-a")
        # After first upgrade local plan is PRO — second different key same plan conflicts.
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="key-b")

    assert exc.value.details["reason"] == "subscription_already_active"
    stripe.checkout.Session.create.assert_not_called()
    assert stripe.Subscription.modify.call_count == 1


@pytest.mark.asyncio
async def test_concurrent_requests_cannot_create_duplicate_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    company_id = uuid.uuid4()
    row_lock = asyncio.Lock()
    holders = 0
    max_holders = 0

    db = MagicMock()

    async def flush():
        return None

    async def commit():
        return None

    db.flush = flush
    db.commit = commit
    service = PlatformBillingService(db, company_id=company_id)

    async def get_authoritative():
        return profile

    async def get_authoritative_for_update():
        nonlocal holders, max_holders
        await row_lock.acquire()
        holders += 1
        max_holders = max(max_holders, holders)
        return profile

    service.repo.get_authoritative = get_authoritative  # type: ignore[method-assign]
    service.repo.get_authoritative_for_update = get_authoritative_for_update  # type: ignore[method-assign]

    modify_calls = 0

    def modify(*_a, **_k):
        nonlocal modify_calls
        modify_calls += 1
        profile.plan = PlatformPlan.PRO
        profile.stripe_price_id = "price_pro"
        return {
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }

    stripe = _stripe_mock(subscription_modify=modify)

    async def run_checkout(key: str):
        nonlocal holders
        try:
            return await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key=key)
        finally:
            holders -= 1
            row_lock.release()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        results = await asyncio.gather(
            run_checkout("c-1"),
            run_checkout("c-2"),
            return_exceptions=True,
        )

    assert max_holders == 1  # row lock serializes concurrent upgrades
    successes = [r for r in results if not isinstance(r, Exception)]
    conflicts = [r for r in results if isinstance(r, ConflictError)]
    assert len(successes) == 1
    assert successes[0].mode == "subscription_updated"
    assert len(conflicts) == 1
    assert conflicts[0].details["reason"] == "subscription_already_active"
    assert modify_calls == 1
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_incomplete_blocks_second_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.INCOMPLETE,
        stripe_subscription_id="sub_incomplete",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-inc")

    assert exc.value.details["reason"] == "subscription_incomplete"
    assert service.is_entitled(profile) is False
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_past_due_same_plan_blocks_checkout_no_entitlement(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.PAST_DUE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="idem-pd")

    assert exc.value.details["reason"] == "subscription_past_due"
    assert service.is_entitled(profile) is False
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_past_due_upgrade_updates_existing_not_new_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.PAST_DUE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    modify = MagicMock(
        return_value={
            "id": "sub_1",
            "status": "past_due",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }
    )
    stripe = _stripe_mock(subscription_modify=modify)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-pd-up")

    assert result.mode == "subscription_updated"
    assert profile.plan == PlatformPlan.PRO
    assert profile.status == PlatformSubscriptionStatus.PAST_DUE
    assert service.is_entitled(profile) is False
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_paused_blocks_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.PAUSED,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-paused")

    assert exc.value.details["reason"] == "subscription_paused"
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_canceled_allows_new_checkout_for_resubscribe(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.FREE,
        status=PlatformSubscriptionStatus.CANCELED,
        stripe_subscription_id="sub_old",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    session_create = MagicMock(
        return_value={"id": "cs_resub", "url": "https://checkout.stripe.test/cs_resub"}
    )
    stripe = _stripe_mock(session_create=session_create)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="idem-resub")

    assert result.mode == "checkout"
    session_create.assert_called_once()


@pytest.mark.asyncio
async def test_cross_tenant_isolation_uses_own_profile_only(monkeypatch):
    _enable_billing(monkeypatch)
    company_a = uuid.uuid4()
    company_b = uuid.uuid4()
    profile_a = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_a",
        stripe_customer_id="cus_a",
    )
    profile_b = _profile(
        plan=PlatformPlan.FREE,
        status=PlatformSubscriptionStatus.NO_SUBSCRIPTION,
        stripe_customer_id="cus_b",
    )
    service_a, _ = _service(profile_a, company_id=company_a)
    service_b, _ = _service(profile_b, company_id=company_b)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service_a.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="a")
        assert exc.value.details["reason"] == "subscription_already_active"
        result_b = await service_b.create_checkout(plan=PlatformPlan.STARTER, idempotency_key="b")

    assert result_b.mode == "checkout"
    assert profile_a.stripe_subscription_id == "sub_a"
    assert profile_b.stripe_subscription_id is None


@pytest.mark.asyncio
async def test_checkout_completed_webhook_ignores_duplicate_subscription():
    from app.payments.platform import webhook_handlers as handlers

    company_id = uuid.uuid4()
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_current",
        stripe_customer_id="cus_1",
    )
    db = MagicMock()

    async def flush():
        return None

    db.flush = flush

    class FakeBilling:
        def __init__(self, *_a, **_k):
            pass

        async def get_profile(self):
            return profile

    with patch.object(handlers, "PlatformBillingService", FakeBilling):
        returned = await handlers._dispatch(
            db,
            "checkout.session.completed",
            {
                "data": {
                    "object": {
                        "mode": "subscription",
                        "customer": "cus_1",
                        "subscription": "sub_duplicate",
                        "metadata": {
                            "domain": "platform_billing",
                            "company_id": str(company_id),
                            "plan": "pro",
                        },
                        "client_reference_id": str(company_id),
                    }
                }
            },
            event_id="evt_dup_checkout",
        )

    assert returned == company_id
    assert profile.stripe_subscription_id == "sub_current"
    assert profile.plan == PlatformPlan.STARTER
    assert profile.status == PlatformSubscriptionStatus.ACTIVE


@pytest.mark.asyncio
async def test_cancel_still_modifies_existing_subscription(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.PRO,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_pro",
    )
    service, _ = _service(profile)
    modify = MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": True,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }
    )
    stripe = _stripe_mock(subscription_modify=modify)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.cancel_at_period_end()

    assert result.cancel_at_period_end is True
    assert result.stripe_subscription_id == "sub_1"
    modify.assert_called_once_with("sub_1", cancel_at_period_end=True)

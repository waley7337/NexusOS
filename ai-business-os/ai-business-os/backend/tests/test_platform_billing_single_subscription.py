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
    assert kwargs["proration_behavior"] == "always_invoice"
    assert kwargs["payment_behavior"] == "pending_if_incomplete"
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
async def test_past_due_plan_change_blocked_portal_recovery(monkeypatch):
    """past_due must recover payment via portal — no create_prorations / plan change."""
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
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-pd-up")

    assert exc.value.details["reason"] == "subscription_past_due"
    assert profile.plan == PlatformPlan.STARTER
    assert service.is_entitled(profile) is False
    stripe.Subscription.modify.assert_not_called()
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_upgrade_payment_required_does_not_grant_new_plan(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    modify = MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "pending_update": {
                "subscription_items": [{"id": "si_1", "price": "price_pro"}],
            },
            "items": {"data": [{"id": "si_1", "price": {"id": "price_starter"}}]},
        }
    )
    stripe = _stripe_mock(subscription_modify=modify)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-pay")

    assert exc.value.details["reason"] == "subscription_upgrade_payment_required"
    assert profile.plan == PlatformPlan.STARTER
    assert profile.status == PlatformSubscriptionStatus.ACTIVE
    assert service.is_entitled(profile) is True  # still entitled to existing paid plan
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_upgrade_stripe_failure_does_not_change_local_plan(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock(subscription_modify=MagicMock(side_effect=RuntimeError("stripe down")))

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-fail")

    assert exc.value.details["reason"] == "stripe_subscription_update_failed"
    assert profile.plan == PlatformPlan.STARTER
    assert profile.stripe_price_id == "price_starter"


@pytest.mark.asyncio
async def test_retry_after_stripe_success_skips_duplicate_proration(monkeypatch):
    """Stripe modify succeeded earlier; local commit failed — retry must not re-prorate."""
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    retrieve = MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }
    )
    stripe = _stripe_mock(subscription_retrieve=retrieve)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-retry")

    assert result.mode == "subscription_updated"
    assert profile.plan == PlatformPlan.PRO
    stripe.Subscription.modify.assert_not_called()
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


@pytest.mark.asyncio
async def test_trialing_upgrade_modifies_existing_not_checkout(monkeypatch):
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.TRIALING,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        result = await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-trial")

    assert result.mode == "subscription_updated"
    assert service.is_entitled(profile) is True
    stripe.checkout.Session.create.assert_not_called()
    stripe.Subscription.modify.assert_called_once()


@pytest.mark.asyncio
async def test_unpaid_status_blocks_like_past_due(monkeypatch):
    """Stripe unpaid maps to PAST_DUE locally — no second checkout / upgrade modify."""
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.PAST_DUE,  # mapped from Stripe unpaid
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
    )
    service, _ = _service(profile)
    stripe = _stripe_mock()

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-unpaid")

    assert exc.value.details["reason"] == "subscription_past_due"
    assert service.is_entitled(profile) is False
    stripe.Subscription.modify.assert_not_called()
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_upgrade_commit_failure_leaves_local_plan_until_retry(monkeypatch):
    """Stripe modify OK but DB commit fails — local plan must not look upgraded yet."""
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)

    async def fail_commit():
        raise RuntimeError("db commit failed")

    service.db.commit = fail_commit  # type: ignore[method-assign]
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
        with pytest.raises(RuntimeError, match="db commit failed"):
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-commit")

    # Snapshot may have mutated the in-memory profile before commit; durable store
    # would roll back. Retry path (retrieve already on price_pro) is covered separately.
    modify.assert_called_once()
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_retry_same_idempotency_key_multiple_times_reconciles(monkeypatch):
    """First retry syncs from Stripe; subsequent same-plan call is already_active (no re-modify)."""
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    retrieve = MagicMock(
        return_value={
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
        }
    )
    stripe = _stripe_mock(subscription_retrieve=retrieve)

    with patch("app.payments.platform.billing_service.stripe_module", return_value=stripe):
        first = await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-multi")
        with pytest.raises(ConflictError) as exc:
            await service.create_checkout(plan=PlatformPlan.PRO, idempotency_key="idem-multi")

    assert first.mode == "subscription_updated"
    assert profile.plan == PlatformPlan.PRO
    assert exc.value.details["reason"] == "subscription_already_active"
    stripe.Subscription.modify.assert_not_called()
    stripe.checkout.Session.create.assert_not_called()


@pytest.mark.asyncio
async def test_out_of_order_subscription_webhook_ignored_after_cancel():
    from app.payments.platform import webhook_handlers as handlers

    company_id = uuid.uuid4()
    profile = _profile(
        plan=PlatformPlan.FREE,
        status=PlatformSubscriptionStatus.CANCELED,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    db = MagicMock()

    async def flush():
        return None

    db.flush = flush

    class FakeBilling:
        def __init__(self, *_a, **_k):
            pass

        async def apply_subscription_snapshot(self, subscription, *, event_id, fallback_plan=None):
            service = PlatformBillingService(db, company_id=company_id)

            async def get_authoritative():
                return profile

            service.repo.get_authoritative = get_authoritative  # type: ignore[method-assign]
            return await service.apply_subscription_snapshot(
                subscription, event_id=event_id, fallback_plan=fallback_plan
            )

    with patch.object(handlers, "PlatformBillingService", FakeBilling):
        with patch.object(
            handlers,
            "_company_from_subscription",
            return_value=company_id,
        ):
            await handlers._dispatch(
                db,
                "customer.subscription.updated",
                {
                    "data": {
                        "object": {
                            "id": "sub_1",
                            "status": "active",
                            "customer": "cus_1",
                            "cancel_at_period_end": False,
                            "items": {"data": [{"id": "si_1", "price": {"id": "price_pro"}}]},
                            "metadata": {"company_id": str(company_id)},
                        }
                    }
                },
                event_id="evt_stale_active",
            )

    assert profile.status == PlatformSubscriptionStatus.CANCELED
    assert profile.plan == PlatformPlan.FREE
    # FREE plan remains entitled regardless of canceled paid-sub history.
    assert PlatformBillingService(db, company_id=company_id).is_entitled(profile) is True


@pytest.mark.asyncio
async def test_invoice_paid_promotes_past_due_exactly_once():
    from app.payments.platform import webhook_handlers as handlers

    company_id = uuid.uuid4()
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.PAST_DUE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
    )
    db = MagicMock()
    flush_count = 0

    async def flush():
        nonlocal flush_count
        flush_count += 1

    db.flush = flush
    entitlement = PlatformBillingService(db, company_id=company_id)

    class FakeBilling:
        def __init__(self, *_a, **_k):
            pass

        async def get_profile(self):
            return profile

    with patch.object(handlers, "PlatformBillingService", FakeBilling):
        with patch.object(handlers, "_company_from_invoice", return_value=company_id):
            await handlers._dispatch(
                db,
                "invoice.paid",
                {"data": {"object": {"subscription": "sub_1", "customer": "cus_1"}}},
                event_id="evt_paid_1",
            )
            assert profile.status == PlatformSubscriptionStatus.ACTIVE
            assert entitlement.is_entitled(profile) is True
            first_flushes = flush_count
            # Second paid event while already ACTIVE is a no-op (status gate).
            await handlers._dispatch(
                db,
                "invoice.paid",
                {"data": {"object": {"subscription": "sub_1", "customer": "cus_1"}}},
                event_id="evt_paid_2",
            )

    assert profile.status == PlatformSubscriptionStatus.ACTIVE
    assert flush_count == first_flushes  # no second mutation


@pytest.mark.asyncio
async def test_invoice_payment_failed_does_not_grant_entitlement():
    from app.payments.platform import webhook_handlers as handlers

    company_id = uuid.uuid4()
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
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
        with patch.object(handlers, "_company_from_invoice", return_value=company_id):
            await handlers._dispatch(
                db,
                "invoice.payment_failed",
                {"data": {"object": {"subscription": "sub_1", "customer": "cus_1"}}},
                event_id="evt_fail",
            )

    assert profile.status == PlatformSubscriptionStatus.PAST_DUE
    assert PlatformBillingService(db, company_id=company_id).is_entitled(profile) is False


@pytest.mark.asyncio
async def test_pending_update_expired_keeps_old_plan_on_snapshot(monkeypatch):
    """After pending_update expires, Stripe items remain on old price — do not grant upgrade."""
    _enable_billing(monkeypatch)
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_1",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    await service.apply_subscription_snapshot(
        {
            "id": "sub_1",
            "status": "active",
            "customer": "cus_1",
            "cancel_at_period_end": False,
            "pending_update": None,
            "items": {"data": [{"id": "si_1", "price": {"id": "price_starter"}}]},
        },
        event_id="evt_expired_pending",
        fallback_plan=None,
    )
    assert profile.plan == PlatformPlan.STARTER
    assert profile.stripe_price_id == "price_starter"
    assert service.is_entitled(profile) is True


@pytest.mark.asyncio
async def test_snapshot_ignores_other_subscription_id():
    profile = _profile(
        plan=PlatformPlan.STARTER,
        status=PlatformSubscriptionStatus.ACTIVE,
        stripe_subscription_id="sub_live",
        stripe_customer_id="cus_1",
        stripe_price_id="price_starter",
    )
    service, _ = _service(profile)
    await service.apply_subscription_snapshot(
        {
            "id": "sub_other",
            "status": "active",
            "customer": "cus_1",
            "items": {"data": [{"id": "si_x", "price": {"id": "price_pro"}}]},
        },
        event_id="evt_other",
    )
    assert profile.stripe_subscription_id == "sub_live"
    assert profile.plan == PlatformPlan.STARTER

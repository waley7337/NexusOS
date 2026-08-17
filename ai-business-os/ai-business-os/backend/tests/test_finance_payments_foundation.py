"""Finance/payments foundation security tests — Part 08.1."""
from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.models import Company, User  # noqa: E402
from app.models.enums import (  # noqa: E402
    PaymentProviderKind,
    PlatformPlan,
    PlatformSubscriptionStatus,
    ProviderConnectionStatus,
    UserStatus,
    WebhookDomain,
    WebhookProcessingStatus,
)
from app.models.payments import (  # noqa: E402
    IdempotencyRecord,
    PaymentProviderAccount,
    PlatformBillingProfile,
    ProviderWebhookEvent,
)


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_payment_provider_account_unique_per_company_provider(db):
    company = Company(name="Pay Co A", slug=f"pay-a-{os.urandom(4).hex()}")
    db.add(company)
    await db.flush()

    first = PaymentProviderAccount(
        company_id=company.id,
        provider=PaymentProviderKind.STRIPE,
        external_account_id=f"acct_{os.urandom(6).hex()}",
        connection_status=ProviderConnectionStatus.ACTIVE,
    )
    db.add(first)
    await db.flush()

    duplicate = PaymentProviderAccount(
        company_id=company.id,
        provider=PaymentProviderKind.STRIPE,
        external_account_id=f"acct_{os.urandom(6).hex()}",
        connection_status=ProviderConnectionStatus.PENDING,
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_payment_provider_external_account_id_unique(db):
    a = Company(name="Pay Co B1", slug=f"pay-b1-{os.urandom(4).hex()}")
    b = Company(name="Pay Co B2", slug=f"pay-b2-{os.urandom(4).hex()}")
    db.add_all([a, b])
    await db.flush()

    ext = f"acct_shared_{os.urandom(4).hex()}"
    db.add(
        PaymentProviderAccount(
            company_id=a.id,
            provider=PaymentProviderKind.STRIPE,
            external_account_id=ext,
            connection_status=ProviderConnectionStatus.ACTIVE,
        )
    )
    await db.flush()

    db.add(
        PaymentProviderAccount(
            company_id=b.id,
            provider=PaymentProviderKind.STRIPE,
            external_account_id=ext,
            connection_status=ProviderConnectionStatus.ACTIVE,
        )
    )
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_webhook_event_deduplication(db):
    event = ProviderWebhookEvent(
        provider=PaymentProviderKind.STRIPE,
        domain=WebhookDomain.TENANT_PAYMENTS,
        external_event_id=f"evt_{os.urandom(6).hex()}",
        event_type="payment_intent.succeeded",
        processing_status=WebhookProcessingStatus.RECEIVED,
        received_at=datetime.now(UTC),
    )
    db.add(event)
    await db.flush()

    dup = ProviderWebhookEvent(
        provider=PaymentProviderKind.STRIPE,
        domain=WebhookDomain.TENANT_PAYMENTS,
        external_event_id=event.external_event_id,
        event_type="payment_intent.succeeded",
        processing_status=WebhookProcessingStatus.RECEIVED,
        received_at=datetime.now(UTC),
    )
    db.add(dup)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_idempotency_unique_per_company_scope(db):
    company = Company(name="Idem Co", slug=f"idem-{os.urandom(4).hex()}")
    db.add(company)
    await db.flush()

    record = IdempotencyRecord(
        company_id=company.id,
        scope="payment.create",
        idempotency_key="key-1",
        expires_at=datetime.now(UTC),
    )
    db.add(record)
    await db.flush()

    dup = IdempotencyRecord(
        company_id=company.id,
        scope="payment.create",
        idempotency_key="key-1",
        expires_at=datetime.now(UTC),
    )
    db.add(dup)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_platform_billing_profile_one_to_one(db):
    company = Company(name="Bill Co", slug=f"bill-{os.urandom(4).hex()}")
    db.add(company)
    await db.flush()

    profile = PlatformBillingProfile(
        company_id=company.id,
        plan=PlatformPlan.FREE,
        status=PlatformSubscriptionStatus.TRIALING,
    )
    db.add(profile)
    await db.flush()

    row = (
        await db.execute(
            select(PlatformBillingProfile).where(PlatformBillingProfile.company_id == company.id)
        )
    ).scalar_one()
    assert row.status == PlatformSubscriptionStatus.TRIALING


@pytest.mark.asyncio
async def test_expense_paid_by_cross_tenant_rejected(db):
    a = Company(name="Exp A", slug=f"exp-a-{os.urandom(4).hex()}")
    b = Company(name="Exp B", slug=f"exp-b-{os.urandom(4).hex()}")
    db.add_all([a, b])
    await db.flush()

    user_b = User(
        company_id=b.id,
        first_name="B",
        last_name="User",
        email=f"b-{os.urandom(4).hex()}@example.com",
        password_hash="x",
        status=UserStatus.ACTIVE,
    )
    db.add(user_b)
    await db.flush()

    from app.models.finance import Expense
    from datetime import date

    forged = Expense(
        company_id=a.id,
        category="Travel",
        amount=100,
        currency="USD",
        date=date.today(),
        paid_by=user_b.id,
    )
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


def test_provider_account_metadata_does_not_include_secret_keys():
    account = PaymentProviderAccount(
        company_id=uuid.uuid4(),
        provider=PaymentProviderKind.STRIPE,
        external_account_id="acct_test",
        connection_status=ProviderConnectionStatus.PENDING,
        metadata_json={"capabilities": {"card_payments": "active"}},
    )
    dumped = account.metadata_json or {}
    for key in dumped:
        assert "secret" not in key.lower()
        assert "token" not in key.lower()

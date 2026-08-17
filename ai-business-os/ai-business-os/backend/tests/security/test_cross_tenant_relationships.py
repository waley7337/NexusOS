"""Cross-tenant relationship protection.

Tenant isolation must hold for *relationships*, not just top-level rows: a
Tenant A child record must never be able to reference a Tenant B parent
record, even if application code forgets to check. These composite foreign
keys (`(child_fk, company_id) REFERENCES (parent.id, parent.company_id)`)
make that a database-level guarantee, not just an application-level one —
this suite proves the DB actually rejects the forged reference rather than
silently allowing it.

Skipped automatically when TEST_DATABASE_URL isn't set (e.g. CI without pg).
"""
import os
from datetime import date, timedelta

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy.exc import IntegrityError  # noqa: E402

TEST_DB = os.environ.get("TEST_DATABASE_URL", os.environ["DATABASE_URL"])
pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.models import Company, Contact, Customer, CustomerNote, Invoice, Lead  # noqa: E402
from app.models.enums import InvoiceStatus  # noqa: E402


@pytest_asyncio.fixture
async def two_tenants_with_customers():
    """Two companies, each with its own customer. Cleaned up afterwards."""
    engine = create_async_engine(TEST_DB, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as db:
        a = Company(name="Tenant A", slug=f"xt-a-{os.urandom(4).hex()}")
        b = Company(name="Tenant B", slug=f"xt-b-{os.urandom(4).hex()}")
        db.add_all([a, b])
        await db.flush()

        ca = Customer(company_id=a.id, company_name="Acme (A)")
        cb = Customer(company_id=b.id, company_name="Globex (B)")
        db.add_all([ca, cb])
        await db.commit()

        yield db, a, b, ca, cb

        await db.rollback()
        await db.delete(ca)
        await db.delete(cb)
        await db.delete(a)
        await db.delete(b)
        await db.commit()
    await engine.dispose()


@pytest.mark.asyncio
async def test_contact_cannot_reference_a_different_tenants_customer(
    two_tenants_with_customers,
):
    """A forged/buggy `customer_id` pointing at another tenant's customer,
    combined with *this* tenant's own `company_id`, must be rejected by the
    database itself — the composite FK has no row to match against."""
    db, a, b, ca, cb = two_tenants_with_customers

    # Tenant A contact record, but customer_id forged to Tenant B's customer.
    forged = Contact(
        company_id=a.id,
        customer_id=cb.id,
        first_name="Evil",
        last_name="Forge",
    )
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_contact_within_same_tenant_is_allowed(two_tenants_with_customers):
    """Sanity check: the composite FK doesn't break the legitimate same-tenant
    case it's supposed to keep working."""
    db, a, b, ca, cb = two_tenants_with_customers

    legit = Contact(
        company_id=a.id,
        customer_id=ca.id,
        first_name="Real",
        last_name="Contact",
    )
    db.add(legit)
    await db.flush()
    assert legit.id is not None
    await db.delete(legit)
    await db.commit()


@pytest.mark.asyncio
async def test_lead_cannot_reference_a_different_tenants_customer(
    two_tenants_with_customers,
):
    db, a, b, ca, cb = two_tenants_with_customers

    forged = Lead(company_id=a.id, customer_id=cb.id)
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_invoice_cannot_reference_a_different_tenants_customer(
    two_tenants_with_customers,
):
    """Invoice -> Customer is the flagship example from the spec: a Company A
    invoice must never be able to bill a Company B customer."""
    db, a, b, ca, cb = two_tenants_with_customers

    today = date.today()
    forged = Invoice(
        company_id=a.id,
        customer_id=cb.id,
        invoice_number=f"INV-XT-{os.urandom(3).hex()}",
        issue_date=today,
        due_date=today + timedelta(days=30),
        status=InvoiceStatus.DRAFT,
        subtotal=100,
        tax=0,
        total=100,
    )
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()


@pytest.mark.asyncio
async def test_customer_note_cannot_reference_a_different_tenants_customer(
    two_tenants_with_customers,
):
    db, a, b, ca, cb = two_tenants_with_customers

    forged = CustomerNote(company_id=a.id, customer_id=cb.id, content="Cross-tenant")
    db.add(forged)
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()

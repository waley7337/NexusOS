"""Finance: invoices + items, expenses, payments.
Money is NUMERIC — never float."""
import uuid
from datetime import date

from sqlalchemy import (
    Date, Enum, ForeignKey, ForeignKeyConstraint, Index, Numeric, String,
    Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin
from app.models.enums import InvoiceStatus, PaymentMethod, PaymentStatus


class Invoice(Base, TenantBusinessMixin):
    __tablename__ = "invoices"
    __table_args__ = (
        # Partial unique index (not a plain UniqueConstraint): a voided/
        # soft-deleted invoice must free its number for reuse.
        Index(
            "ix_invoices_company_number_active_uq", "company_id", "invoice_number",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_invoices_company_status", "company_id", "status"),
        Index("ix_invoices_company_due", "company_id", "due_date"),
        # A Company-A invoice must never be able to bill a Company-B
        # customer — see PRIMARY OBJECTIVE §7 (cross-tenant relationships).
        ForeignKeyConstraint(
            ["customer_id", "company_id"], ["customers.id", "customers.company_id"],
            name="fk_invoices_customer_id_tenant_scoped", ondelete="RESTRICT",
        ),
        # Composite-FK anchor for InvoiceItem/Payment.invoice_id (below).
        UniqueConstraint("id", "company_id", name="uq_invoices_id_company"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    invoice_number: Mapped[str] = mapped_column(String(40), nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, native_enum=False, length=20),
        default=InvoiceStatus.DRAFT, nullable=False,
    )
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    tax: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    # foreign_keys= disambiguates: invoice_items/payments now have both the
    # plain single-column FK and the tenant-scoped composite FK to invoices.
    items: Mapped[list["InvoiceItem"]] = relationship(
        back_populates="invoice", foreign_keys="InvoiceItem.invoice_id"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", foreign_keys="Payment.invoice_id"
    )


class InvoiceItem(Base, TenantBusinessMixin):
    __tablename__ = "invoice_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["invoice_id", "company_id"], ["invoices.id", "invoices.company_id"],
            name="fk_invoice_items_invoice_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    invoice: Mapped["Invoice"] = relationship(
        back_populates="items", foreign_keys=[invoice_id]
    )


class Expense(Base, TenantBusinessMixin):
    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_company_date", "company_id", "date"),
    )

    category: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class Payment(Base, TenantBusinessMixin):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_company_status", "company_id", "status"),
        ForeignKeyConstraint(
            ["invoice_id", "company_id"], ["invoices.id", "invoices.company_id"],
            name="fk_payments_invoice_id_tenant_scoped", ondelete="RESTRICT",
        ),
    )

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, native_enum=False, length=20), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False, length=15),
        default=PaymentStatus.PENDING, nullable=False,
    )

    invoice: Mapped["Invoice"] = relationship(
        back_populates="payments", foreign_keys=[invoice_id]
    )

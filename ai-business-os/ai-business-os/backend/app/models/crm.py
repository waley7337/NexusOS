"""CRM: customers → contacts / leads → deals / meetings / notes.

Everything connected, no duplicate data. Child tables still carry
company_id (TenantBusinessMixin): isolation never depends on a join.
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date, DateTime, Enum, ForeignKey, ForeignKeyConstraint, Index, Integer,
    Numeric, String, Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin
from app.models.enums import CustomerStatus, DealStatus, MeetingType, PipelineStage


class Customer(Base, TenantBusinessMixin):
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customers_company_status", "company_id", "status"),
        Index("ix_customers_company_created", "company_id", "created_at"),
        Index("ix_customers_company_owner", "company_id", "owner_id"),
        # Composite-FK anchor: lets child tables (contacts, leads, invoices, …)
        # pin their parent reference to a customer *in their own tenant* —
        # see the ForeignKeyConstraint on each child below.
        UniqueConstraint("id", "company_id", name="uq_customers_id_company"),
    )

    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    status: Mapped[CustomerStatus] = mapped_column(
        Enum(CustomerStatus, native_enum=False, length=20),
        default=CustomerStatus.LEAD, nullable=False,
    )
    source: Mapped[str | None] = mapped_column(String(100))

    # `foreign_keys=` disambiguates the join: each child now has *two* FK
    # paths to this table (the original single-column FK, plus the tenant-
    # scoped composite FK added for cross-tenant protection) — both point
    # at the same logical relationship, so pin the plain one for ORM joins.
    contacts: Mapped[list["Contact"]] = relationship(
        back_populates="customer", foreign_keys="Contact.customer_id"
    )
    leads: Mapped[list["Lead"]] = relationship(
        back_populates="customer", foreign_keys="Lead.customer_id"
    )


class Contact(Base, TenantBusinessMixin):
    __tablename__ = "contacts"
    __table_args__ = (
        # Cross-tenant relationship protection: customer_id must resolve to
        # a customer row that belongs to *this same* company_id. Without
        # this, a forged/stale customer_id could point at another tenant's
        # customer while still passing the plain single-column FK check.
        ForeignKeyConstraint(
            ["customer_id", "company_id"], ["customers.id", "customers.company_id"],
            name="fk_contacts_customer_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[str | None] = mapped_column(String(120))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    linkedin: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    customer: Mapped["Customer"] = relationship(
        back_populates="contacts", foreign_keys=[customer_id]
    )


class Lead(Base, TenantBusinessMixin):
    __tablename__ = "leads"
    __table_args__ = (
        Index("ix_leads_company_stage", "company_id", "pipeline_stage"),
        Index("ix_leads_company_assigned", "company_id", "assigned_to"),
        ForeignKeyConstraint(
            ["customer_id", "company_id"], ["customers.id", "customers.company_id"],
            name="fk_leads_customer_id_tenant_scoped", ondelete="CASCADE",
        ),
        # Composite-FK anchor for Deal.lead_id (see below).
        UniqueConstraint("id", "company_id", name="uq_leads_id_company"),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    pipeline_stage: Mapped[PipelineStage] = mapped_column(
        Enum(PipelineStage, native_enum=False, length=20),
        default=PipelineStage.NEW, nullable=False,
    )
    estimated_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    probability: Mapped[int | None] = mapped_column(Integer)  # 0–100
    expected_close_date: Mapped[date | None] = mapped_column(Date)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    customer: Mapped["Customer"] = relationship(
        back_populates="leads", foreign_keys=[customer_id]
    )
    deal: Mapped["Deal | None"] = relationship(
        back_populates="lead", foreign_keys="Deal.lead_id"
    )


class Deal(Base, TenantBusinessMixin):
    __tablename__ = "deals"
    __table_args__ = (
        Index("ix_deals_company_status", "company_id", "status"),
        ForeignKeyConstraint(
            ["lead_id", "company_id"], ["leads.id", "leads.company_id"],
            name="fk_deals_lead_id_tenant_scoped", ondelete="CASCADE",
        ),
        # Partial unique index, not a plain unique column: a soft-deleted
        # deal must free its lead for a fresh one-to-one deal.
        Index(
            "ix_deals_lead_id_active_uq", "lead_id",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
    )
    value: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[DealStatus] = mapped_column(
        Enum(DealStatus, native_enum=False, length=10),
        default=DealStatus.OPEN, nullable=False,
    )
    won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lost_reason: Mapped[str | None] = mapped_column(Text)

    lead: Mapped["Lead"] = relationship(
        back_populates="deal", foreign_keys=[lead_id]
    )


class Meeting(Base, TenantBusinessMixin):
    __tablename__ = "meetings"
    __table_args__ = (
        Index("ix_meetings_company_start", "company_id", "start_time"),
        ForeignKeyConstraint(
            ["customer_id", "company_id"], ["customers.id", "customers.company_id"],
            name="fk_meetings_customer_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    meeting_type: Mapped[MeetingType] = mapped_column(
        Enum(MeetingType, native_enum=False, length=15),
        default=MeetingType.VIDEO, nullable=False,
    )


class CustomerNote(Base, TenantBusinessMixin):
    __tablename__ = "customer_notes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["customer_id", "company_id"], ["customers.id", "customers.company_id"],
            name="fk_customer_notes_customer_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)

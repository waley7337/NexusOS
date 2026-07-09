"""Declarative base and shared mixins — Part 3 global table standards.

Every business table gets, via `TenantBusinessMixin`:

    id (UUID v7)  company_id  created_at  updated_at
    created_by    updated_by  deleted_at  is_active

Conventions:
  * UUID v7 primary keys — time-ordered, index-friendly at scale
  * UTC timestamps managed by the database
  * Soft deletes (deleted_at) — data is never physically destroyed
  * created_by / updated_by — ownership tracking (SET NULL if user removed)
  * TenantMixin adds company_id — the multi-tenancy backbone; the
    BaseRepository refuses to query a tenant model without it.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, MetaData, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

from app.utils.uuid7 import uuid7

# Naming convention → deterministic constraint names → clean Alembic diffs
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class AuditedByMixin:
    """Who created / last touched the row. Nullable: system actions and
    removed users must not break history (ON DELETE SET NULL)."""

    @declared_attr
    def created_by(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey("users.id", ondelete="SET NULL", use_alter=True),
            nullable=True,
        )

    @declared_attr
    def updated_by(cls) -> Mapped[uuid.UUID | None]:  # noqa: N805
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey("users.id", ondelete="SET NULL", use_alter=True),
            nullable=True,
        )


class ActiveMixin:
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class TenantMixin:
    """Marks a model as tenant-owned. Every query against a TenantMixin model
    MUST be scoped by company_id — enforced by BaseRepository.

    Child tables (contacts, invoice_items, …) carry company_id too, even when
    reachable through a parent: isolation must never depend on a join."""

    @declared_attr
    def company_id(cls) -> Mapped[uuid.UUID]:  # noqa: N805
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )


class TenantBusinessMixin(
    TenantMixin, TimestampMixin, SoftDeleteMixin, AuditedByMixin, ActiveMixin
):
    """The full Part 3 standard column set for tenant business tables."""

"""companies — the tenant root. Not tenant-scoped itself (it IS the tenant)."""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import ActiveMixin, Base, SoftDeleteMixin, TimestampMixin
from app.models.enums import SubscriptionPlan, SubscriptionStatus

if TYPE_CHECKING:
    from app.models.user import User


class Company(Base, TimestampMixin, SoftDeleteMixin, ActiveMixin):
    __tablename__ = "companies"
    __table_args__ = (
        # Partial unique index, not a plain UniqueConstraint: a soft-deleted
        # company must free its slug for reuse (§18 soft-delete/uniqueness).
        Index(
            "ix_companies_slug_active_uq", "slug",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    industry: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)

    subscription_plan: Mapped[SubscriptionPlan] = mapped_column(
        Enum(SubscriptionPlan, native_enum=False, length=20),
        default=SubscriptionPlan.FREE,
        nullable=False,
    )
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, native_enum=False, length=20),
        default=SubscriptionStatus.TRIALING,
        nullable=False,
    )
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    users: Mapped[list["User"]] = relationship(back_populates="company")

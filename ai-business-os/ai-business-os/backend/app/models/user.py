"""users, roles, permissions — identity and RBAC.

RBAC model:
  * permissions are GLOBAL definitions ("customers.read") seeded by the app
  * roles are PER-COMPANY (each tenant can customize)
  * role_permissions / user_roles are pure association tables
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, String, Table, Text,
    UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    ActiveMixin, Base, SoftDeleteMixin, TenantMixin, TimestampMixin,
)
from app.models.enums import UserStatus

if TYPE_CHECKING:
    from app.models.company import Company

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", UUID(as_uuid=True), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base, TenantMixin, TimestampMixin, SoftDeleteMixin, ActiveMixin):
    __tablename__ = "users"
    __table_args__ = (
        # Email is unique WITHIN a company (same person can join two tenants)
        # among ACTIVE rows only — a plain (unfiltered) unique constraint
        # would permanently squat the email after a soft delete, blocking a
        # legitimate re-invite. Partial index is the soft-delete-safe form
        # (§18 — soft-delete/uniqueness compatibility).
        Index(
            "ix_users_company_email_active_uq", "company_id", "email",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_users_company_status", "company_id", "status"),
        # Composite-FK anchor for Employee.user_id (app/models/hr.py) — an
        # employee record must be tied to a user in that same company.
        UniqueConstraint("id", "company_id", name="uq_users_id_company"),
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))  # null → OAuth-only
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(40))
    job_title: Mapped[str | None] = mapped_column(String(120))
    department: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, native_enum=False, length=20),
        default=UserStatus.INVITED,
        nullable=False,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    company: Mapped["Company"] = relationship(back_populates="users")
    # `order_by` makes `user.roles[0]` (the "primary role" used for the JWT
    # `role` claim and `require_roles()`, see `auth_service._primary_role_name`
    # / `dependencies.auth.get_current_active_user`) a deterministic function
    # of role *name* rather than unspecified DB/relationship-load order
    # (Part 3.1 remediation, SEC-002). This does not encode a privilege
    # hierarchy — it only guarantees the same user always resolves to the
    # same "primary" role across requests/processes. Not reachable today
    # (registration assigns exactly one role); becomes load-bearing the
    # moment multi-role assignment ships.
    roles: Mapped[list["Role"]] = relationship(
        secondary=user_roles, back_populates="users", order_by="Role.name"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Role(Base, TenantMixin, TimestampMixin):
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("company_id", "name", name="uq_roles_company_name"),
    )

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    permissions: Mapped[list["Permission"]] = relationship(
        secondary=role_permissions, back_populates="roles"
    )
    users: Mapped[list["User"]] = relationship(secondary=user_roles, back_populates="roles")


class Permission(Base):
    """Global permission catalog: '<module>.<action>' e.g. customers.read."""

    __tablename__ = "permissions"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permissions, back_populates="permissions"
    )

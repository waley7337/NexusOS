"""users, roles, permissions — identity and RBAC.

RBAC model:
  * permissions are GLOBAL definitions ("customers.read") seeded by the app
  * roles are PER-COMPANY (each tenant can customize)
  * role_permissions / user_roles are pure association tables
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index, String, Table, Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import (
    ActiveMixin, Base, SoftDeleteMixin, TenantMixin, TimestampMixin,
)
from app.models.enums import UserStatus

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
        UniqueConstraint("company_id", "email", name="uq_users_company_email"),
        Index("ix_users_company_status", "company_id", "status"),
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

    company: Mapped["Company"] = relationship(back_populates="users")  # noqa: F821
    roles: Mapped[list["Role"]] = relationship(secondary=user_roles, back_populates="users")

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

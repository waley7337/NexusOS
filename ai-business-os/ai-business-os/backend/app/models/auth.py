"""Auth plumbing — refresh sessions + single-use tokens.

Not tenant business data (no TenantMixin, no BaseRepository): these rows are
purely about *this user's* auth lifecycle, and every query here is already
scoped by `user_id` or by the opaque token itself. Deliberately outside the
`TenantBusinessMixin` convention (§ database.md) since they carry no
`company_id` and are never listed/paginated per tenant.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import AuthTokenPurpose


class Session(Base, TimestampMixin):
    """One row per issued refresh token. Rotated on every use, revocable.

    `jti` is the refresh token's JWT id claim — the token itself is never
    stored, only the id used to look up and invalidate it (mirrors
    `password_hash`: we keep what's needed to verify, not the secret).
    """

    __tablename__ = "sessions"
    __table_args__ = (
        Index("ix_sessions_user_revoked", "user_id", "revoked_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(64))

    @property
    def is_valid(self) -> bool:
        return self.revoked_at is None and self.expires_at > datetime.now(timezone.utc)


class AuthToken(Base, TimestampMixin):
    """Single-use token for email verification / password reset.

    Only the SHA-256 hash of the token is stored (see
    `app.core.security.hash_opaque_token`) — same principle as password
    hashing: a DB leak must not hand out working tokens.
    """

    __tablename__ = "auth_tokens"
    __table_args__ = (
        Index("ix_auth_tokens_user_purpose", "user_id", "purpose"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    purpose: Mapped[AuthTokenPurpose] = mapped_column(
        Enum(AuthTokenPurpose, native_enum=False, length=30), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > datetime.now(timezone.utc)

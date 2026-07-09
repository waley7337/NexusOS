"""Activity feed — powers 'Recent activity' on the dashboard. Append-only."""
import uuid

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class Activity(Base, TenantMixin, TimestampMixin):
    __tablename__ = "activities"
    __table_args__ = (
        Index("ix_activities_company_created", "company_id", "created_at"),
        Index("ix_activities_entity", "entity", "entity_id"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String(100), nullable=False)

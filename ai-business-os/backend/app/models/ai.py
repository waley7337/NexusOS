"""AI module: conversations, messages, generated reports."""
import uuid

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin, TenantMixin, TimestampMixin
from app.models.enums import AiRole


class AiConversation(Base, TenantBusinessMixin):
    __tablename__ = "ai_conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title: Mapped[str | None] = mapped_column(String(255))

    messages: Mapped[list["AiMessage"]] = relationship(back_populates="conversation")


class AiMessage(Base, TenantMixin, TimestampMixin):
    __tablename__ = "ai_messages"
    __table_args__ = (
        Index("ix_ai_messages_conversation_created", "conversation_id", "created_at"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    role: Mapped[AiRole] = mapped_column(
        Enum(AiRole, native_enum=False, length=10), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tokens: Mapped[int | None] = mapped_column(Integer)

    conversation: Mapped["AiConversation"] = relationship(back_populates="messages")


class AiGeneratedReport(Base, TenantMixin, TimestampMixin):
    __tablename__ = "ai_generated_reports"

    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    generated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    pdf_url: Mapped[str | None] = mapped_column(String(500))

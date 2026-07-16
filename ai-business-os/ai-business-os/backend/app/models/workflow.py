"""Workflow automation: triggers + ordered steps with JSONB configuration."""
import uuid
from typing import Any

from sqlalchemy import (
    Boolean, ForeignKey, ForeignKeyConstraint, Integer, String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin, TenantMixin, TimestampMixin


class Workflow(Base, TenantBusinessMixin):
    __tablename__ = "workflows"
    __table_args__ = (
        # Composite-FK anchor for WorkflowStep.workflow_id (below).
        UniqueConstraint("id", "company_id", name="uq_workflows_id_company"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trigger: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. customer.created
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    steps: Mapped[list["WorkflowStep"]] = relationship(
        back_populates="workflow", order_by="WorkflowStep.step_order",
        foreign_keys="WorkflowStep.workflow_id",
    )


class WorkflowStep(Base, TenantMixin, TimestampMixin):
    __tablename__ = "workflow_steps"
    __table_args__ = (
        UniqueConstraint("workflow_id", "step_order", name="uq_workflow_steps_order"),
        ForeignKeyConstraint(
            ["workflow_id", "company_id"], ["workflows.id", "workflows.company_id"],
            name="fk_workflow_steps_workflow_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. send_email
    configuration: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    workflow: Mapped["Workflow"] = relationship(
        back_populates="steps", foreign_keys=[workflow_id]
    )

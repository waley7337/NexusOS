"""AI business tools — defines what the agent can do on behalf of the user.

Security model:
  * Every tool declares required_permissions. The agent orchestrator checks
    these against the caller's real-time permission set (derived from DB on
    every request) before executing. Model output cannot bypass this check.
  * Tools operate through existing tenant-scoped repositories; they never
    run raw SQL or bypass company_id isolation.
  * write=True tools produce a ConfirmationRequired event instead of
    executing immediately. The frontend must show a confirmation dialog and
    the user must explicitly re-submit before the write is applied.
  * Tool arguments are validated with Pydantic before any DB access.
  * Tool results are plain JSON dicts — never objects with methods that
    could be misused. Sensitive fields (passwords, tokens) are stripped.

Supported tools:
  Read-only:
    crm_search_customers      — search customers by name/company
    crm_search_leads          — search active leads
    crm_search_deals          — search open deals
    finance_outstanding_invoices — unpaid/overdue invoices summary
    finance_invoice_detail    — invoice breakdown by number
    hr_search_employees       — search employees (basic fields only)
    projects_list_projects    — list projects with status filter
    projects_list_tasks       — list tasks with status/project filter
    reports_summary           — cross-module KPI summary (last 30 days)

  Write (require explicit user confirmation):
    projects_create_task      — create a new task in an existing project
    projects_update_task_status — move a task to a new status

Adding a new tool:
  1. Write a Pydantic args class.
  2. Write an async executor function.
  3. Call `tool_registry.register(ToolDefinition(...))`.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Callable

import structlog
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import CurrentUser

logger = structlog.get_logger("app.ai.tools")

# ---------------------------------------------------------------------------
# Tool infrastructure
# ---------------------------------------------------------------------------

@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters_schema: dict       # OpenAI-style JSON schema for the function arguments
    executor: Callable            # async (args_dict, db, user) -> dict
    required_permissions: list[str] = field(default_factory=list)
    write: bool = False           # True ⟹ needs explicit user confirmation
    danger_description: str = ""  # Shown in the confirmation prompt (write tools only)


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def all_definitions(self) -> list[ToolDefinition]:
        return list(self._tools.values())

    def openai_schemas(
        self,
        *,
        permitted: frozenset[str],
        include_write: bool = False,
    ) -> list[dict]:
        """Return OpenAI-format tool definitions for tools the user can access.

        Args:
            permitted:     The user's real-time permission set.
            include_write: Whether to include write tools (False by default;
                           set True only after explicit confirmation).
        """
        result = []
        for td in self._tools.values():
            if td.write and not include_write:
                continue
            if any(p not in permitted for p in td.required_permissions):
                continue
            result.append({
                "type": "function",
                "function": {
                    "name": td.name,
                    "description": td.description,
                    "parameters": td.parameters_schema,
                },
            })
        return result


tool_registry = ToolRegistry()


# ---------------------------------------------------------------------------
# Tool argument models (Pydantic — validate before any DB access)
# ---------------------------------------------------------------------------

class SearchArgs(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    limit: int = Field(default=5, ge=1, le=20)


class OutstandingInvoicesArgs(BaseModel):
    limit: int = Field(default=10, ge=1, le=20)


class InvoiceDetailArgs(BaseModel):
    invoice_number: str = Field(..., min_length=1, max_length=50)


class ProjectsListArgs(BaseModel):
    status: str | None = Field(default=None)
    limit: int = Field(default=10, ge=1, le=20)

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str | None) -> str | None:
        allowed = {"planned", "active", "on_hold", "completed", "archived", None}
        if v is not None and v not in allowed:
            raise ValueError(f"status must be one of {allowed - {None}}")
        return v


class TasksListArgs(BaseModel):
    project_name: str | None = Field(default=None, max_length=200)
    status: str | None = Field(default=None)
    limit: int = Field(default=10, ge=1, le=20)

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str | None) -> str | None:
        allowed = {"backlog", "todo", "in_progress", "in_review", "done", "canceled", None}
        if v is not None and v not in allowed:
            raise ValueError(f"status must be one of {allowed - {None}}")
        return v


class CreateTaskArgs(BaseModel):
    project_id: str = Field(..., description="UUID of the project")
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    priority: str = Field(default="medium")

    @field_validator("project_id")
    @classmethod
    def _valid_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError as exc:
            raise ValueError("project_id must be a valid UUID") from exc
        return v

    @field_validator("priority")
    @classmethod
    def _valid_priority(cls, v: str) -> str:
        if v not in {"low", "medium", "high", "urgent"}:
            raise ValueError("priority must be one of: low, medium, high, urgent")
        return v


class UpdateTaskStatusArgs(BaseModel):
    task_id: str = Field(..., description="UUID of the task to update")
    status: str = Field(...)

    @field_validator("task_id")
    @classmethod
    def _valid_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except ValueError as exc:
            raise ValueError("task_id must be a valid UUID") from exc
        return v

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in {"backlog", "todo", "in_progress", "in_review", "done", "canceled"}:
            raise ValueError("invalid task status")
        return v


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _ilike(raw: str) -> str:
    escaped = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# ---------------------------------------------------------------------------
# CRM executors
# ---------------------------------------------------------------------------

async def _exec_crm_search_customers(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = SearchArgs(**args)
    from app.models.crm import Customer
    stmt = (
        select(
            Customer.id, Customer.company_name, Customer.email,
            Customer.status, Customer.city, Customer.country,
        )
        .where(
            Customer.company_id == user.company_id,
            Customer.deleted_at.is_(None),
            Customer.company_name.ilike(_ilike(a.query)),
        )
        .order_by(Customer.company_name)
        .limit(a.limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return {
        "count": len(rows),
        "customers": [
            {
                "id": str(r["id"]),
                "company_name": r["company_name"],
                "email": r["email"],
                "status": r["status"].value if hasattr(r["status"], "value") else r["status"],
                "city": r["city"],
                "country": r["country"],
            }
            for r in rows
        ],
    }


async def _exec_crm_search_leads(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = SearchArgs(**args)
    from app.models.crm import Lead
    stmt = (
        select(Lead.id, Lead.title, Lead.pipeline_stage, Lead.estimated_value, Lead.currency)
        .where(
            Lead.company_id == user.company_id,
            Lead.deleted_at.is_(None),
            Lead.title.ilike(_ilike(a.query)),
        )
        .order_by(Lead.created_at.desc())
        .limit(a.limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return {
        "count": len(rows),
        "leads": [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "pipeline_stage": r["pipeline_stage"].value if hasattr(r["pipeline_stage"], "value") else r["pipeline_stage"],
                "estimated_value": str(r["estimated_value"]) if r["estimated_value"] else None,
                "currency": r["currency"],
            }
            for r in rows
        ],
    }


async def _exec_crm_search_deals(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = SearchArgs(**args)
    from app.models.crm import Deal
    stmt = (
        select(Deal.id, Deal.title, Deal.status, Deal.value, Deal.currency, Deal.close_date)
        .where(
            Deal.company_id == user.company_id,
            Deal.deleted_at.is_(None),
            Deal.title.ilike(_ilike(a.query)),
        )
        .order_by(Deal.created_at.desc())
        .limit(a.limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return {
        "count": len(rows),
        "deals": [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "status": r["status"].value if hasattr(r["status"], "value") else r["status"],
                "value": str(r["value"]) if r["value"] else None,
                "currency": r["currency"],
                "close_date": str(r["close_date"]) if r["close_date"] else None,
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# Finance executors
# ---------------------------------------------------------------------------

async def _exec_finance_outstanding_invoices(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = OutstandingInvoicesArgs(**args)
    from app.models.finance import Invoice
    from app.models.enums import InvoiceStatus

    outstanding_statuses = [
        InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE
    ]
    stmt = (
        select(
            Invoice.id, Invoice.invoice_number, Invoice.status,
            Invoice.total, Invoice.currency, Invoice.due_date,
        )
        .where(
            Invoice.company_id == user.company_id,
            Invoice.deleted_at.is_(None),
            Invoice.status.in_(outstanding_statuses),
        )
        .order_by(Invoice.due_date.asc().nullslast())
        .limit(a.limit)
    )
    rows = (await db.execute(stmt)).mappings().all()

    # Aggregate total outstanding
    agg_stmt = (
        select(func.sum(Invoice.total))
        .where(
            Invoice.company_id == user.company_id,
            Invoice.deleted_at.is_(None),
            Invoice.status.in_(outstanding_statuses),
        )
    )
    total_outstanding = (await db.execute(agg_stmt)).scalar_one() or 0

    return {
        "total_outstanding": str(total_outstanding),
        "count": len(rows),
        "invoices": [
            {
                "id": str(r["id"]),
                "invoice_number": r["invoice_number"],
                "status": r["status"].value if hasattr(r["status"], "value") else r["status"],
                "total": str(r["total"]) if r["total"] else None,
                "currency": r["currency"],
                "due_date": str(r["due_date"]) if r["due_date"] else None,
            }
            for r in rows
        ],
    }


async def _exec_finance_invoice_detail(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = InvoiceDetailArgs(**args)
    from app.models.finance import Invoice
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Invoice)
        .options(selectinload(Invoice.items))
        .where(
            Invoice.company_id == user.company_id,
            Invoice.invoice_number == a.invoice_number,
            Invoice.deleted_at.is_(None),
        )
    )
    invoice = (await db.execute(stmt)).scalar_one_or_none()
    if invoice is None:
        return {"error": f"Invoice {a.invoice_number!r} not found."}

    return {
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "status": invoice.status.value,
        "total": str(invoice.total) if invoice.total else None,
        "subtotal": str(invoice.subtotal) if invoice.subtotal else None,
        "currency": invoice.currency,
        "issue_date": str(invoice.issue_date) if invoice.issue_date else None,
        "due_date": str(invoice.due_date) if invoice.due_date else None,
        "line_items": [
            {
                "description": item.description,
                "quantity": str(item.quantity),
                "unit_price": str(item.unit_price),
                "total": str(item.total) if item.total else None,
            }
            for item in invoice.items
        ],
    }


# ---------------------------------------------------------------------------
# HR executors
# ---------------------------------------------------------------------------

async def _exec_hr_search_employees(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = SearchArgs(**args)
    from app.models.hr import Employee

    stmt = (
        select(
            Employee.id, Employee.employee_number,
            Employee.first_name, Employee.last_name,
            Employee.job_title, Employee.department,
            Employee.status, Employee.employment_type,
        )
        .where(
            Employee.company_id == user.company_id,
            Employee.deleted_at.is_(None),
            (
                Employee.first_name.ilike(_ilike(a.query)) |
                Employee.last_name.ilike(_ilike(a.query)) |
                Employee.department.ilike(_ilike(a.query)) |
                Employee.job_title.ilike(_ilike(a.query))
            ),
        )
        .order_by(Employee.last_name, Employee.first_name)
        .limit(a.limit)
    )
    rows = (await db.execute(stmt)).mappings().all()
    return {
        "count": len(rows),
        "employees": [
            {
                "id": str(r["id"]),
                "employee_number": r["employee_number"],
                "name": f"{r['first_name']} {r['last_name']}",
                "job_title": r["job_title"],
                "department": r["department"],
                "status": r["status"].value if hasattr(r["status"], "value") else r["status"],
                "employment_type": r["employment_type"].value if hasattr(r["employment_type"], "value") else r["employment_type"],
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# Projects/Tasks executors
# ---------------------------------------------------------------------------

async def _exec_projects_list(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = ProjectsListArgs(**args)
    from app.models.project import Project

    stmt = select(
        Project.id, Project.name, Project.status,
        Project.priority, Project.due_date, Project.progress,
    ).where(
        Project.company_id == user.company_id,
        Project.deleted_at.is_(None),
    )
    if a.status is not None:
        stmt = stmt.where(Project.status == a.status)
    stmt = stmt.order_by(Project.created_at.desc()).limit(a.limit)

    rows = (await db.execute(stmt)).mappings().all()
    return {
        "count": len(rows),
        "projects": [
            {
                "id": str(r["id"]),
                "name": r["name"],
                "status": r["status"].value if hasattr(r["status"], "value") else r["status"],
                "priority": r["priority"].value if hasattr(r["priority"], "value") else r["priority"],
                "due_date": str(r["due_date"]) if r["due_date"] else None,
                "progress": r["progress"],
            }
            for r in rows
        ],
    }


async def _exec_tasks_list(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = TasksListArgs(**args)
    from app.models.project import Project, Task

    stmt = (
        select(
            Task.id, Task.title, Task.status, Task.priority,
            Task.due_date, Project.name.label("project_name"),
        )
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.company_id == user.company_id,
            Task.deleted_at.is_(None),
        )
    )
    if a.status is not None:
        stmt = stmt.where(Task.status == a.status)
    if a.project_name is not None:
        stmt = stmt.where(Project.name.ilike(_ilike(a.project_name)))
    stmt = stmt.order_by(Task.created_at.desc()).limit(a.limit)

    rows = (await db.execute(stmt)).mappings().all()
    return {
        "count": len(rows),
        "tasks": [
            {
                "id": str(r["id"]),
                "title": r["title"],
                "project": r["project_name"],
                "status": r["status"].value if hasattr(r["status"], "value") else r["status"],
                "priority": r["priority"].value if hasattr(r["priority"], "value") else r["priority"],
                "due_date": str(r["due_date"]) if r["due_date"] else None,
            }
            for r in rows
        ],
    }


async def _exec_reports_summary(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    """30-day KPI summary reused from the /reports/summary endpoint logic."""
    company_id = str(user.company_id)
    to_date = date.today()
    from_date = to_date - timedelta(days=30)

    invoice_rows = (
        await db.execute(
            text(
                "SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total_amount "
                "FROM invoices "
                "WHERE company_id = :cid AND deleted_at IS NULL "
                "AND issue_date BETWEEN :fd AND :td "
                "GROUP BY status"
            ),
            {"cid": company_id, "fd": from_date, "td": to_date},
        )
    ).fetchall()

    crm_row = (
        await db.execute(
            text(
                "SELECT "
                "(SELECT COUNT(*) FROM customers WHERE company_id=:cid AND deleted_at IS NULL) AS customers, "
                "(SELECT COUNT(*) FROM leads WHERE company_id=:cid AND deleted_at IS NULL AND pipeline_stage NOT IN ('won','lost')) AS open_leads"
            ),
            {"cid": company_id},
        )
    ).fetchone()

    return {
        "period": {"from": str(from_date), "to": str(to_date)},
        "finance_invoices": {
            row.status: {"count": row.count, "total": str(row.total_amount)}
            for row in invoice_rows
        },
        "crm": {
            "customers": crm_row.customers if crm_row else 0,
            "open_leads": crm_row.open_leads if crm_row else 0,
        },
    }


# ---------------------------------------------------------------------------
# Write executors — produce a preview dict (confirmed by orchestrator)
# ---------------------------------------------------------------------------

async def _exec_create_task(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    """Creates a task. Only called after user confirmation is verified."""
    a = CreateTaskArgs(**args)
    from app.models.project import Project, Task
    from app.models.enums import TaskStatus

    # Verify project belongs to this tenant.
    project = (await db.execute(
        select(Project).where(
            Project.id == uuid.UUID(a.project_id),
            Project.company_id == user.company_id,
            Project.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if project is None:
        return {"error": f"Project {a.project_id!r} not found or not accessible."}

    task = Task(
        company_id=user.company_id,
        project_id=project.id,
        title=a.title,
        description=a.description,
        priority=a.priority,
        status=TaskStatus.TODO,
        reporter_id=user.id,
    )
    db.add(task)
    await db.flush()
    return {
        "created": True,
        "task_id": str(task.id),
        "title": task.title,
        "project": project.name,
        "status": task.status.value,
    }


async def _exec_update_task_status(
    args: dict, db: AsyncSession, user: CurrentUser
) -> dict:
    a = UpdateTaskStatusArgs(**args)
    from app.models.project import Task

    task = (await db.execute(
        select(Task).where(
            Task.id == uuid.UUID(a.task_id),
            Task.company_id == user.company_id,
            Task.deleted_at.is_(None),
        )
    )).scalar_one_or_none()
    if task is None:
        return {"error": f"Task {a.task_id!r} not found or not accessible."}

    old_status = task.status.value if hasattr(task.status, "value") else task.status
    task.status = a.status  # type: ignore[assignment]
    await db.flush()
    return {
        "updated": True,
        "task_id": str(task.id),
        "title": task.title,
        "old_status": old_status,
        "new_status": a.status,
    }


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

tool_registry.register(ToolDefinition(
    name="crm_search_customers",
    description="Search CRM customers by company name. Returns id, name, email, status.",
    parameters_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Company name or partial name to search for"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
        },
        "required": ["query"],
    },
    executor=_exec_crm_search_customers,
    required_permissions=["customers.read"],
))

tool_registry.register(ToolDefinition(
    name="crm_search_leads",
    description="Search CRM leads by title. Returns pipeline stage and estimated value.",
    parameters_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Lead title or keyword"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
        },
        "required": ["query"],
    },
    executor=_exec_crm_search_leads,
    required_permissions=["leads.read"],
))

tool_registry.register(ToolDefinition(
    name="crm_search_deals",
    description="Search CRM deals by title. Returns deal status and value.",
    parameters_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Deal title or keyword"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
        },
        "required": ["query"],
    },
    executor=_exec_crm_search_deals,
    required_permissions=["deals.read"],
))

tool_registry.register(ToolDefinition(
    name="finance_outstanding_invoices",
    description="List unpaid, partially paid, and overdue invoices. Shows total outstanding balance.",
    parameters_schema={
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 10},
        },
        "required": [],
    },
    executor=_exec_finance_outstanding_invoices,
    required_permissions=["invoices.read"],
))

tool_registry.register(ToolDefinition(
    name="finance_invoice_detail",
    description="Get full details of a specific invoice by invoice number, including line items.",
    parameters_schema={
        "type": "object",
        "properties": {
            "invoice_number": {"type": "string", "description": "The invoice number, e.g. INV-001"},
        },
        "required": ["invoice_number"],
    },
    executor=_exec_finance_invoice_detail,
    required_permissions=["invoices.read"],
))

tool_registry.register(ToolDefinition(
    name="hr_search_employees",
    description="Search employees by name, department, or job title. Returns basic non-sensitive fields only.",
    parameters_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Name, department, or job title to search"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
        },
        "required": ["query"],
    },
    executor=_exec_hr_search_employees,
    required_permissions=["employees.read"],
))

tool_registry.register(ToolDefinition(
    name="projects_list_projects",
    description="List projects, optionally filtered by status. Returns name, status, priority, progress.",
    parameters_schema={
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["planned", "active", "on_hold", "completed", "archived"],
                "description": "Filter by project status",
            },
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 10},
        },
        "required": [],
    },
    executor=_exec_projects_list,
    required_permissions=["projects.read"],
))

tool_registry.register(ToolDefinition(
    name="projects_list_tasks",
    description="List tasks, optionally filtered by project name or status.",
    parameters_schema={
        "type": "object",
        "properties": {
            "project_name": {"type": "string", "description": "Filter by project name (partial match)"},
            "status": {
                "type": "string",
                "enum": ["backlog", "todo", "in_progress", "in_review", "done", "canceled"],
                "description": "Filter by task status",
            },
            "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 10},
        },
        "required": [],
    },
    executor=_exec_tasks_list,
    required_permissions=["tasks.read"],
))

tool_registry.register(ToolDefinition(
    name="reports_summary",
    description="Get a high-level KPI summary for the last 30 days across Finance and CRM.",
    parameters_schema={
        "type": "object",
        "properties": {},
        "required": [],
    },
    executor=_exec_reports_summary,
    required_permissions=["reports.view"],
))

tool_registry.register(ToolDefinition(
    name="projects_create_task",
    description="Create a new task in a project. Requires user confirmation before executing.",
    parameters_schema={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "UUID of the project"},
            "title": {"type": "string", "description": "Task title"},
            "description": {"type": "string", "description": "Optional task description"},
            "priority": {
                "type": "string",
                "enum": ["low", "medium", "high", "urgent"],
                "default": "medium",
            },
        },
        "required": ["project_id", "title"],
    },
    executor=_exec_create_task,
    required_permissions=["tasks.create"],
    write=True,
    danger_description="Create a new task",
))

tool_registry.register(ToolDefinition(
    name="projects_update_task_status",
    description="Update the status of an existing task. Requires user confirmation before executing.",
    parameters_schema={
        "type": "object",
        "properties": {
            "task_id": {"type": "string", "description": "UUID of the task to update"},
            "status": {
                "type": "string",
                "enum": ["backlog", "todo", "in_progress", "in_review", "done", "canceled"],
            },
        },
        "required": ["task_id", "status"],
    },
    executor=_exec_update_task_status,
    required_permissions=["tasks.update"],
    write=True,
    danger_description="Update task status",
))

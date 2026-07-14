"""Model registry — importing this package registers every table with
Base.metadata (required for Alembic autogenerate)."""
from app.models.base import Base
from app.models.company import Company
from app.models.user import Permission, Role, User, role_permissions, user_roles
from app.models.auth import AuthToken, Session
from app.models.crm import Contact, Customer, CustomerNote, Deal, Lead, Meeting
from app.models.project import Project, Task, TaskAttachment, TaskComment
from app.models.hr import Attendance, Employee, LeaveRequest
from app.models.finance import Expense, Invoice, InvoiceItem, Payment
from app.models.inventory import (
    Product, PurchaseOrder, StockLevel, Supplier, Warehouse,
)
from app.models.document import Document
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.models.ai import AiConversation, AiGeneratedReport, AiMessage
from app.models.workflow import Workflow, WorkflowStep
from app.models.activity import Activity

__all__ = [
    "Base", "Company", "User", "Role", "Permission", "role_permissions",
    "user_roles", "Session", "AuthToken", "Customer", "Contact", "Lead", "Deal", "Meeting",
    "CustomerNote", "Project", "Task", "TaskComment", "TaskAttachment",
    "Employee", "LeaveRequest", "Attendance", "Invoice", "InvoiceItem",
    "Expense", "Payment", "Product", "Warehouse", "StockLevel", "Supplier",
    "PurchaseOrder", "Document", "Notification", "AuditLog",
    "AiConversation", "AiMessage", "AiGeneratedReport", "Workflow",
    "WorkflowStep", "Activity",
]

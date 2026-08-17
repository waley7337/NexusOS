"""Status enums — stored as plain VARCHAR (native_enum=False) so adding a
value is a code change, not a locking ALTER TYPE migration."""
import enum


class SubscriptionPlan(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"


class UserStatus(str, enum.Enum):
    INVITED = "invited"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class AuthTokenPurpose(str, enum.Enum):
    """Single-use token purposes — see app/models/auth.py `AuthToken`."""

    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


class CustomerStatus(str, enum.Enum):
    LEAD = "lead"
    ACTIVE = "active"
    INACTIVE = "inactive"
    CHURNED = "churned"


class PipelineStage(str, enum.Enum):
    NEW = "new"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class DealStatus(str, enum.Enum):
    OPEN = "open"
    WON = "won"
    LOST = "lost"


class MeetingType(str, enum.Enum):
    CALL = "call"
    VIDEO = "video"
    IN_PERSON = "in_person"


class ProjectStatus(str, enum.Enum):
    PLANNED = "planned"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, enum.Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    CANCELED = "canceled"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERN = "intern"


class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"


class LeaveType(str, enum.Enum):
    VACATION = "vacation"
    SICK = "sick"
    PERSONAL = "personal"
    PARENTAL = "parental"
    UNPAID = "unpaid"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    VOID = "void"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    CASH = "cash"
    STRIPE = "stripe"
    OTHER = "other"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentSource(str, enum.Enum):
    MANUAL = "manual"
    PROVIDER = "provider"


class PaymentProviderKind(str, enum.Enum):
    STRIPE = "stripe"


class ProviderConnectionStatus(str, enum.Enum):
    PENDING = "pending"
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    RESTRICTED = "restricted"
    DISCONNECTED = "disconnected"


class WebhookDomain(str, enum.Enum):
    PLATFORM_BILLING = "platform_billing"
    TENANT_PAYMENTS = "tenant_payments"


class WebhookProcessingStatus(str, enum.Enum):
    RECEIVED = "received"
    PROCESSED = "processed"
    FAILED = "failed"
    IGNORED = "ignored"


class PlatformPlan(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class PlatformSubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    INCOMPLETE = "incomplete"
    CANCELED = "canceled"
    PAUSED = "paused"


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    ORDERED = "ordered"
    RECEIVED = "received"
    CANCELED = "canceled"


class NotificationType(str, enum.Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ACTION_REQUIRED = "action_required"


class AiRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

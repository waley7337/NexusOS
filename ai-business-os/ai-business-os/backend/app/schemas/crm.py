"""CRM request/response schemas — foundation for Part 06.2+.

Create/Update schemas intentionally omit system/ownership fields
(`company_id`, `created_by`, `updated_by`, `deleted_at`, `id`). The server
stamps those via BaseRepository from trusted auth context.

Wire names are camelCase (aliases); Python attributes are snake_case.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import EmailStr, Field, field_validator

from app.models.enums import CustomerStatus, DealStatus, PipelineStage
from app.schemas.base import CamelModel

# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------


class CustomerCreate(CamelModel):
    company_name: str = Field(alias="companyName", min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    owner_id: uuid.UUID | None = Field(default=None, alias="ownerId")
    status: CustomerStatus = CustomerStatus.LEAD
    source: str | None = Field(default=None, max_length=100)


class CustomerUpdate(CamelModel):
    company_name: str | None = Field(default=None, alias="companyName", min_length=1, max_length=200)
    industry: str | None = Field(default=None, max_length=100)
    website: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    country: str | None = Field(default=None, max_length=100)
    notes: str | None = None
    owner_id: uuid.UUID | None = Field(default=None, alias="ownerId")
    status: CustomerStatus | None = None
    source: str | None = Field(default=None, max_length=100)


class CustomerResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    company_name: str = Field(alias="companyName")
    industry: str | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    notes: str | None = None
    owner_id: uuid.UUID | None = Field(default=None, alias="ownerId")
    status: CustomerStatus
    source: str | None = None
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


class CustomerNoteCreate(CamelModel):
    content: str = Field(min_length=1)


class CustomerNoteUpdate(CamelModel):
    content: str | None = Field(default=None, min_length=1)


class CustomerNoteResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    customer_id: uuid.UUID = Field(alias="customerId")
    author_id: uuid.UUID | None = Field(default=None, alias="authorId")
    content: str
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------


class ContactCreate(CamelModel):
    customer_id: uuid.UUID = Field(alias="customerId")
    first_name: str = Field(alias="firstName", min_length=1, max_length=100)
    last_name: str = Field(alias="lastName", min_length=1, max_length=100)
    position: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    linkedin: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class ContactUpdate(CamelModel):
    customer_id: uuid.UUID | None = Field(default=None, alias="customerId")
    first_name: str | None = Field(default=None, alias="firstName", min_length=1, max_length=100)
    last_name: str | None = Field(default=None, alias="lastName", min_length=1, max_length=100)
    position: str | None = Field(default=None, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    linkedin: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class ContactResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    customer_id: uuid.UUID = Field(alias="customerId")
    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    position: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    notes: str | None = None
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------


class LeadCreate(CamelModel):
    customer_id: uuid.UUID = Field(alias="customerId")
    pipeline_stage: PipelineStage = Field(
        default=PipelineStage.NEW, alias="pipelineStage"
    )
    estimated_value: Decimal | None = Field(default=None, alias="estimatedValue", ge=0)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = Field(default=None, alias="expectedCloseDate")
    assigned_to: uuid.UUID | None = Field(default=None, alias="assignedTo")
    notes: str | None = None


class LeadUpdate(CamelModel):
    customer_id: uuid.UUID | None = Field(default=None, alias="customerId")
    pipeline_stage: PipelineStage | None = Field(default=None, alias="pipelineStage")
    estimated_value: Decimal | None = Field(default=None, alias="estimatedValue", ge=0)
    probability: int | None = Field(default=None, ge=0, le=100)
    expected_close_date: date | None = Field(default=None, alias="expectedCloseDate")
    assigned_to: uuid.UUID | None = Field(default=None, alias="assignedTo")
    notes: str | None = None


class LeadResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    customer_id: uuid.UUID = Field(alias="customerId")
    pipeline_stage: PipelineStage = Field(alias="pipelineStage")
    estimated_value: Decimal | None = Field(default=None, alias="estimatedValue")
    probability: int | None = None
    expected_close_date: date | None = Field(default=None, alias="expectedCloseDate")
    assigned_to: uuid.UUID | None = Field(default=None, alias="assignedTo")
    notes: str | None = None
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


# ---------------------------------------------------------------------------
# Deals
# ---------------------------------------------------------------------------


class DealCreate(CamelModel):
    lead_id: uuid.UUID = Field(alias="leadId")
    value: Decimal = Field(ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    status: DealStatus = DealStatus.OPEN
    won_at: datetime | None = Field(default=None, alias="wonAt")
    lost_reason: str | None = Field(default=None, alias="lostReason")

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, value: str) -> str:
        return value.upper()


class DealUpdate(CamelModel):
    value: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    status: DealStatus | None = None
    won_at: datetime | None = Field(default=None, alias="wonAt")
    lost_reason: str | None = Field(default=None, alias="lostReason")

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else None


class DealResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    lead_id: uuid.UUID = Field(alias="leadId")
    value: Decimal
    currency: str
    status: DealStatus
    won_at: datetime | None = Field(default=None, alias="wonAt")
    lost_reason: str | None = Field(default=None, alias="lostReason")
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")

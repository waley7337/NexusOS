"""Finance request/response schemas — Part 08.2 Invoices API."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import Field, field_validator

from app.models.enums import InvoiceStatus
from app.schemas.base import CamelModel

if TYPE_CHECKING:
    from app.models.finance import Invoice


class InvoiceItemInput(CamelModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"))
    unit_price: Decimal = Field(alias="unitPrice")

    @field_validator("quantity", "unit_price", mode="before")
    @classmethod
    def coerce_decimal(cls, value: object) -> Decimal:
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))


class InvoiceItemResponse(CamelModel):
    id: uuid.UUID
    description: str
    quantity: Decimal
    unit_price: Decimal = Field(alias="unitPrice")
    total: Decimal


class InvoiceCreate(CamelModel):
    invoice_number: str = Field(alias="invoiceNumber", min_length=1, max_length=40)
    customer_id: uuid.UUID = Field(alias="customerId")
    issue_date: date = Field(alias="issueDate")
    due_date: date = Field(alias="dueDate")
    currency: str = Field(default="USD", min_length=3, max_length=3)
    tax: Decimal = Field(default=Decimal("0"))
    items: list[InvoiceItemInput] = Field(min_length=1)

    @field_validator("tax", mode="before")
    @classmethod
    def coerce_tax(cls, value: object) -> Decimal:
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))


class InvoiceUpdate(CamelModel):
    invoice_number: str | None = Field(default=None, alias="invoiceNumber", min_length=1, max_length=40)
    customer_id: uuid.UUID | None = Field(default=None, alias="customerId")
    issue_date: date | None = Field(default=None, alias="issueDate")
    due_date: date | None = Field(default=None, alias="dueDate")
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    tax: Decimal | None = None
    items: list[InvoiceItemInput] | None = None

    @field_validator("tax", mode="before")
    @classmethod
    def coerce_tax(cls, value: object) -> Decimal | None:
        if value is None:
            return None
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))


class InvoiceResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    customer_id: uuid.UUID = Field(alias="customerId")
    invoice_number: str = Field(alias="invoiceNumber")
    issue_date: date = Field(alias="issueDate")
    due_date: date = Field(alias="dueDate")
    status: InvoiceStatus
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    sent_at: datetime | None = Field(default=None, alias="sentAt")
    voided_at: datetime | None = Field(default=None, alias="voidedAt")
    items: list[InvoiceItemResponse]
    amount_paid: Decimal = Field(alias="amountPaid")
    outstanding_balance: Decimal = Field(alias="outstandingBalance")
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


def invoice_to_response(
    invoice: Invoice,
    *,
    amount_paid: Decimal,
    outstanding_balance: Decimal,
) -> InvoiceResponse:
    """Build API response with computed payment summary fields."""
    return InvoiceResponse.model_validate(
        {
            "id": invoice.id,
            "companyId": invoice.company_id,
            "customerId": invoice.customer_id,
            "invoiceNumber": invoice.invoice_number,
            "issueDate": invoice.issue_date,
            "dueDate": invoice.due_date,
            "status": invoice.status,
            "subtotal": invoice.subtotal,
            "tax": invoice.tax,
            "total": invoice.total,
            "currency": invoice.currency,
            "sentAt": invoice.sent_at,
            "voidedAt": invoice.voided_at,
            "items": [
                {
                    "id": item.id,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unitPrice": item.unit_price,
                    "total": item.total,
                }
                for item in invoice.items
            ],
            "amountPaid": amount_paid,
            "outstandingBalance": outstanding_balance,
            "isActive": invoice.is_active,
            "createdAt": invoice.created_at,
            "updatedAt": invoice.updated_at,
            "createdBy": invoice.created_by,
            "updatedBy": invoice.updated_by,
            "deletedAt": invoice.deleted_at,
        }
    )

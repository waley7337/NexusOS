"""Finance request/response schemas — Part 08.2 Invoices API."""

from __future__ import annotations

import uuid
import re
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Annotated

from pydantic import Field, WithJsonSchema, field_validator

from app.models.enums import InvoiceStatus, PaymentMethod, PaymentSource, PaymentStatus
from app.payments.money import quantize_money
from app.schemas.base import CamelModel

if TYPE_CHECKING:
    from app.models.finance import Invoice, Payment


class InvoiceItemInput(CamelModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    unit_price: Decimal = Field(alias="unitPrice", ge=0)

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
    tax: Decimal = Field(default=Decimal("0"), ge=0)
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
    tax: Decimal | None = Field(default=None, ge=0)
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
    customer_name: str = Field(alias="customerName")
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


_MAX_PAYMENT_AMOUNT = Decimal("999999999999.99")
_PLAIN_DECIMAL_PATTERN = re.compile(r"^[0-9]+(?:\.[0-9]+)?$")
PaymentMoney = Annotated[
    Decimal,
    WithJsonSchema(
        {
            "type": "string",
            "description": "Positive decimal money string, normalized to two places.",
            "pattern": r"^[0-9]+(?:\.[0-9]+)?$",
            "examples": ["100.00"],
        }
    ),
]


def _payment_money(value: object) -> Decimal:
    """Parse the Payment API's deliberately string-only money contract."""
    if not isinstance(value, str):
        raise ValueError("Money must be provided as a JSON string.")
    if _PLAIN_DECIMAL_PATTERN.fullmatch(value) is None:
        raise ValueError("Money must use plain decimal notation.")
    try:
        amount = Decimal(value)
        if not amount.is_finite():
            raise ValueError
        amount = quantize_money(amount)
    except (ArithmeticError, ValueError) as exc:
        raise ValueError("Money must be a finite decimal string.") from exc
    if amount <= 0:
        raise ValueError("Money must be greater than zero.")
    if amount > _MAX_PAYMENT_AMOUNT:
        raise ValueError("Money exceeds NUMERIC(14,2) capacity.")
    return amount


class ManualPaymentCreate(CamelModel):
    amount: PaymentMoney
    currency: str = Field(min_length=3, max_length=3)
    payment_date: date = Field(alias="paymentDate")
    payment_method: PaymentMethod = Field(alias="paymentMethod")
    notes: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value: object) -> Decimal:
        return _payment_money(value)


class ManualPaymentRefund(CamelModel):
    amount: PaymentMoney
    reason: str

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value: object) -> Decimal:
        return _payment_money(value)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        reason = value.strip()
        if not reason:
            raise ValueError("Refund reason is required.")
        return reason


class PaymentResponse(CamelModel):
    id: uuid.UUID
    invoice_id: uuid.UUID = Field(alias="invoiceId")
    amount: str
    currency: str
    status: PaymentStatus
    payment_date: date = Field(alias="paymentDate")
    payment_method: PaymentMethod = Field(alias="paymentMethod")
    source: PaymentSource
    refunded_amount: str = Field(alias="refundedAmount")
    confirmed_at: datetime | None = Field(default=None, alias="confirmedAt")
    refunded_at: datetime | None = Field(default=None, alias="refundedAt")
    refund_reason: str | None = Field(default=None, alias="refundReason")
    notes: str | None = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


def payment_to_response(payment: Payment) -> PaymentResponse:
    return PaymentResponse.model_validate(
        {
            "id": payment.id,
            "invoiceId": payment.invoice_id,
            "amount": format(payment.amount, ".2f"),
            "currency": payment.currency,
            "status": payment.status,
            "paymentDate": payment.payment_date,
            "paymentMethod": payment.payment_method,
            "source": payment.source,
            "refundedAmount": format(payment.refunded_amount, ".2f"),
            "confirmedAt": payment.confirmed_at,
            "refundedAt": payment.refunded_at,
            "refundReason": payment.refund_reason,
            "notes": payment.notes,
            "createdAt": payment.created_at,
            "updatedAt": payment.updated_at,
        }
    )


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
            "customerName": invoice.customer.company_name,
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

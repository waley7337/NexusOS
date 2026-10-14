"""Finance repositories — tenant-scoped invoice lifecycle (Part 08.2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, List

from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.models.crm import Customer
from app.models.enums import InvoiceStatus
from app.models.finance import Expense, Invoice, InvoiceItem, Payment
from app.models.user import User
from app.payments.currency import normalize_currency
from app.payments.money import effective_payment_amount, invoice_subtotal, invoice_total, line_total, quantize_money
from app.repositories.base import DEFAULT_PAGE_SIZE, BaseRepository

_MAX_SEARCH_LEN = 100
_FINANCIAL_UPDATE_FIELDS = frozenset(
    {"customer_id", "invoice_number", "issue_date", "due_date", "currency", "tax", "items"}
)
_IMMUTABLE_STATUSES = frozenset({InvoiceStatus.PAID, InvoiceStatus.VOID})


class InvoiceRepository(BaseRepository[Invoice]):
    model = Invoice
    SORT_FIELDS = {
        "created_at": Invoice.created_at,
        "issue_date": Invoice.issue_date,
        "due_date": Invoice.due_date,
        "invoice_number": Invoice.invoice_number,
        "total": Invoice.total,
        "status": Invoice.status,
    }

    async def ensure_customer_in_tenant(self, customer_id: uuid.UUID) -> None:
        """Reject customers that are missing, soft-deleted, or other-tenant."""
        self._require_tenant_context()
        stmt = select(Customer.id).where(
            Customer.id == customer_id,
            Customer.company_id == self.company_id,
            Customer.deleted_at.is_(None),
        )
        found = (await self.db.execute(stmt)).scalar_one_or_none()
        if found is None:
            raise ValidationError("Customer must belong to the current company.")

    async def _ensure_invoice_number_unique(
        self,
        invoice_number: str,
        *,
        exclude_id: uuid.UUID | None = None,
    ) -> None:
        self._require_tenant_context()
        stmt = select(Invoice.id).where(
            Invoice.company_id == self.company_id,
            Invoice.invoice_number == invoice_number,
            Invoice.deleted_at.is_(None),
        )
        if exclude_id is not None:
            stmt = stmt.where(Invoice.id != exclude_id)
        found = (await self.db.execute(stmt)).scalar_one_or_none()
        if found is not None:
            raise ValidationError("Invoice number already exists for this company.")

    @staticmethod
    def _validate_dates(issue_date: date, due_date: date) -> None:
        if due_date < issue_date:
            raise ValidationError("Due date must be on or after issue date.")

    @staticmethod
    def _normalize_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not items:
            raise ValidationError("Invoice must have at least one line item.")
        normalized: list[dict[str, Any]] = []
        for row in items:
            description = (row.get("description") or "").strip()
            if not description:
                raise ValidationError("Line item description is required.")
            quantity = row["quantity"]
            unit_price = row["unit_price"]
            if not isinstance(quantity, Decimal):
                quantity = Decimal(str(quantity))
            if not isinstance(unit_price, Decimal):
                unit_price = Decimal(str(unit_price))
            total = line_total(quantity, unit_price)
            normalized.append(
                {
                    "description": description,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "total": total,
                }
            )
        return normalized

    @classmethod
    def _compute_totals(
        cls,
        items: list[dict[str, Any]],
        tax: Decimal,
    ) -> tuple[Decimal, Decimal, Decimal]:
        if not isinstance(tax, Decimal):
            tax = Decimal(str(tax))
        line_totals = [row["total"] for row in items]
        subtotal = invoice_subtotal(line_totals)
        total = invoice_total(subtotal, tax)
        return subtotal, tax, total

    async def get_with_details(self, invoice_id: uuid.UUID) -> Invoice:
        stmt = (
            self._base_query()
            .options(
                selectinload(Invoice.customer),
                selectinload(Invoice.items),
                selectinload(Invoice.payments),
            )
            .where(Invoice.id == invoice_id)
        )
        result = await self.db.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundError("Invoice not found")
        return entity

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        search: str | None = None,
        status: InvoiceStatus | None = None,
        customer_id: uuid.UUID | None = None,
    ) -> tuple[List[Invoice], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query().options(
            selectinload(Invoice.customer),
            selectinload(Invoice.items),
            selectinload(Invoice.payments),
        )

        if status is not None:
            stmt = stmt.where(Invoice.status == status)
        if customer_id is not None:
            stmt = stmt.where(Invoice.customer_id == customer_id)

        if search:
            term = search.strip()
            if len(term) > _MAX_SEARCH_LEN:
                raise ValidationError(
                    f"Search query must be at most {_MAX_SEARCH_LEN} characters."
                )
            if term:
                pattern = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stmt = stmt.where(Invoice.invoice_number.ilike(f"%{pattern}%", escape="\\"))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all()), total

    async def create_invoice(
        self,
        *,
        invoice_number: str,
        customer_id: uuid.UUID,
        issue_date: date,
        due_date: date,
        currency: str,
        tax: Decimal,
        items: list[dict[str, Any]],
    ) -> Invoice:
        await self.ensure_customer_in_tenant(customer_id)
        number = invoice_number.strip()
        if not number:
            raise ValidationError("Invoice number is required.")
        await self._ensure_invoice_number_unique(number)
        self._validate_dates(issue_date, due_date)
        currency_code = normalize_currency(currency)
        normalized_items = self._normalize_items(items)
        subtotal, tax_amount, total = self._compute_totals(normalized_items, tax)

        invoice = Invoice(
            customer_id=customer_id,
            invoice_number=number,
            issue_date=issue_date,
            due_date=due_date,
            status=InvoiceStatus.DRAFT,
            subtotal=subtotal,
            tax=tax_amount,
            total=total,
            currency=currency_code,
        )
        await self.create(invoice)
        for row in normalized_items:
            item = InvoiceItem(
                company_id=invoice.company_id,
                invoice_id=invoice.id,
                description=row["description"],
                quantity=row["quantity"],
                unit_price=row["unit_price"],
                total=row["total"],
            )
            self.db.add(item)
        await self.db.flush()
        return await self.get_with_details(invoice.id)

    async def update_draft(
        self,
        invoice_id: uuid.UUID,
        values: dict[str, Any],
        *,
        items: list[dict[str, Any]] | None = None,
    ) -> Invoice:
        invoice = await self.get_with_details(invoice_id)
        if invoice.status != InvoiceStatus.DRAFT:
            raise ConflictError("Only draft invoices can be updated.")

        if "customer_id" in values and values["customer_id"] is not None:
            await self.ensure_customer_in_tenant(values["customer_id"])
        if "invoice_number" in values and values["invoice_number"] is not None:
            number = str(values["invoice_number"]).strip()
            if not number:
                raise ValidationError("Invoice number is required.")
            await self._ensure_invoice_number_unique(number, exclude_id=invoice.id)
            values["invoice_number"] = number
        if "currency" in values and values["currency"] is not None:
            values["currency"] = normalize_currency(values["currency"])

        issue_date = values.get("issue_date", invoice.issue_date)
        due_date = values.get("due_date", invoice.due_date)
        self._validate_dates(issue_date, due_date)

        tax = values.get("tax", invoice.tax)
        if items is not None:
            normalized_items = self._normalize_items(items)
            subtotal, tax_amount, total = self._compute_totals(normalized_items, tax)
            await self.db.execute(
                delete(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)
            )
            for row in normalized_items:
                self.db.add(
                    InvoiceItem(
                        company_id=invoice.company_id,
                        invoice_id=invoice.id,
                        description=row["description"],
                        quantity=row["quantity"],
                        unit_price=row["unit_price"],
                        total=row["total"],
                    )
                )
            values["subtotal"] = subtotal
            values["tax"] = tax_amount
            values["total"] = total
        elif "tax" in values:
            normalized_items = [
                {
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total": item.total,
                }
                for item in invoice.items
            ]
            if not normalized_items:
                raise ValidationError("Invoice must have at least one line item.")
            subtotal, tax_amount, total = self._compute_totals(normalized_items, tax)
            values["subtotal"] = subtotal
            values["tax"] = tax_amount
            values["total"] = total

        for field, value in values.items():
            setattr(invoice, field, value)

        if self.user_id is not None:
            invoice.updated_by = self.user_id
        await self.db.flush()
        await self.db.refresh(invoice)
        return await self.get_with_details(invoice.id)

    async def send_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        invoice = await self.get_with_details(invoice_id)
        if invoice.status != InvoiceStatus.DRAFT:
            raise ConflictError("Only draft invoices can be sent.")
        if not invoice.items:
            raise ValidationError("Cannot send an invoice without line items.")
        invoice.status = InvoiceStatus.SENT
        invoice.sent_at = datetime.now(timezone.utc)
        if self.user_id is not None:
            invoice.updated_by = self.user_id
        await self.db.flush()
        await self.db.refresh(invoice)
        return invoice

    async def void_invoice(self, invoice_id: uuid.UUID) -> Invoice:
        stmt = self._base_query().where(Invoice.id == invoice_id).with_for_update()
        invoice = (await self.db.execute(stmt)).scalar_one_or_none()
        if invoice is None:
            raise NotFoundError("Invoice not found")
        if invoice.status in _IMMUTABLE_STATUSES or invoice.status == InvoiceStatus.PARTIALLY_PAID:
            raise ConflictError("Invoice cannot be voided in its current status.")
        payments = list((await self.db.scalars(select(Payment).where(
            Payment.invoice_id == invoice.id,
            Payment.company_id == self.company_id,
            Payment.deleted_at.is_(None),
            Payment.is_active.is_(True),
        ))).all())
        paid = quantize_money(sum((effective_payment_amount(
            status=row.status, amount=row.amount, refunded_amount=row.refunded_amount
        ) for row in payments), start=Decimal("0")))
        if paid > 0:
            raise ConflictError("Cannot void an invoice that has effective payments.")
        invoice.status = InvoiceStatus.VOID
        invoice.voided_at = datetime.now(timezone.utc)
        if self.user_id is not None:
            invoice.updated_by = self.user_id
        await self.db.flush()
        await self.db.refresh(invoice)
        return await self.get_with_details(invoice.id)

    async def archive_draft(self, invoice_id: uuid.UUID) -> Invoice:
        invoice = await self.get(invoice_id)
        if invoice.status != InvoiceStatus.DRAFT:
            raise ConflictError("Only draft invoices can be archived.")
        return await self.soft_delete(invoice_id)

    @staticmethod
    def payment_summary(invoice: Invoice) -> tuple[Decimal, Decimal]:
        paid = quantize_money(
            sum(
                (effective_payment_amount(
                    status=payment.status,
                    amount=payment.amount,
                    refunded_amount=payment.refunded_amount,
                ) for payment in invoice.payments if payment.deleted_at is None and payment.is_active),
                start=Decimal("0"),
            )
        )
        outstanding = quantize_money(invoice.total - paid)
        return paid, outstanding


class ExpenseRepository(BaseRepository[Expense]):
    """Tenant-scoped expense CRUD with optional paid_by validation."""

    model = Expense
    SORT_FIELDS = {
        "created_at": Expense.created_at,
        "date": Expense.date,
        "amount": Expense.amount,
        "category": Expense.category,
    }

    async def ensure_paid_by_in_tenant(self, user_id: uuid.UUID) -> None:
        """Reject paid_by users that are missing, soft-deleted, inactive, or other-tenant."""
        self._require_tenant_context()
        stmt = select(User.id).where(
            User.id == user_id,
            User.company_id == self.company_id,
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
        found = (await self.db.execute(stmt)).scalar_one_or_none()
        if found is None:
            raise ValidationError("Paid-by user must belong to the current company.")

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        category: str | None = None,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[List[Expense], int]:
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if category is not None:
            stmt = stmt.where(Expense.category == category.strip())

        if date_from is not None:
            stmt = stmt.where(Expense.date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Expense.date <= date_to)

        if search:
            term = search.strip()[:_MAX_SEARCH_LEN]
            if term:
                pattern = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stmt = stmt.where(
                    Expense.category.ilike(f"%{pattern}%", escape="\\")
                    | Expense.description.ilike(f"%{pattern}%", escape="\\")
                )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        else:
            stmt = stmt.order_by(Expense.date.desc(), Expense.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

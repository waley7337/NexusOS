"""Tenant invoice Checkout — Connect direct charges only (no platform capture)."""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ValidationError
from app.models.finance import Payment
from app.payments.money import quantize_money, to_minor_units
from app.payments.providers.stripe.client import connected_account_options, stripe_module
from app.payments.stripe_config import require_tenant_payments_enabled
from app.repositories.payment_providers import PaymentProviderAccountRepository
from app.repositories.payments import PaymentRepository
from app.services.payment_service import PaymentService

logger = structlog.get_logger("payments.tenant.checkout")


@dataclass(frozen=True, slots=True)
class InvoiceCheckoutSession:
    payment_id: uuid.UUID
    checkout_session_id: str
    checkout_url: str
    amount: Decimal
    currency: str
    reused: bool


class TenantInvoiceCheckoutService:
    """Creates Stripe Checkout Sessions on the tenant's connected account.

    Fund ownership: proceeds settle on the connected Stripe account (direct
    charge). No application fees — NexusOS does not invent platform commissions.
    Browser redirects are never treated as payment confirmation.
    """

    def __init__(
        self,
        db: AsyncSession,
        *,
        company_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        self.db = db
        self.company_id = company_id
        self.user_id = user_id
        self.payments = PaymentRepository(db, company_id=company_id, user_id=user_id)
        self.providers = PaymentProviderAccountRepository(
            db, company_id=company_id, user_id=user_id
        )
        self.authority = PaymentService(self.payments)

    async def create_checkout(
        self,
        *,
        invoice_id: uuid.UUID,
        idempotency_key: str,
        success_path: str | None = None,
        cancel_path: str | None = None,
    ) -> InvoiceCheckoutSession:
        api_key = require_tenant_payments_enabled()
        provider_account = await self.providers.require_chargeable_stripe()

        invoice, amount, currency = await self.authority.outstanding_for_checkout(invoice_id)
        existing = await self.payments.find_pending_provider_for_invoice(invoice.id)

        if existing is not None and existing.provider_checkout_session_id:
            reused = await self._try_reuse_open_session(
                existing=existing,
                connected_account_id=provider_account.external_account_id,
                api_key=api_key,
            )
            if reused is not None:
                return reused
            await self.authority.fail_provider_payment(
                payment_id=existing.id,
                failure_code="checkout_session_expired",
                failure_message="Previous checkout session is no longer open.",
            )
            await self.db.commit()
            invoice, amount, currency = await self.authority.outstanding_for_checkout(invoice_id)
            existing = None

        if existing is None:
            payment = await self.authority.create_pending_provider_payment(
                invoice=invoice,
                amount=amount,
                currency=currency,
                provider_account_id=provider_account.id,
                idempotency_key=idempotency_key,
            )
        else:
            payment = existing
            if quantize_money(payment.amount) != quantize_money(amount):
                payment.amount = quantize_money(amount)
                await self.db.flush()

        # Commit so concurrent checkout requests observe the pending guard
        # before the Stripe network call.
        await self.db.commit()

        try:
            session = self._create_stripe_session(
                api_key=api_key,
                connected_account_id=provider_account.external_account_id,
                company_id=self.company_id,
                invoice_id=invoice.id,
                payment_id=payment.id,
                amount=amount,
                currency=currency,
                idempotency_key=idempotency_key,
                success_path=success_path,
                cancel_path=cancel_path,
            )
        except Exception as exc:
            await self.authority.fail_provider_payment(
                payment_id=payment.id,
                failure_code="checkout_session_create_failed",
                failure_message="Unable to create Stripe Checkout Session.",
            )
            await self.db.commit()
            logger.warning(
                "tenant_checkout_create_failed",
                payment_id=str(payment.id),
                invoice_id=str(invoice_id),
                error_type=type(exc).__name__,
            )
            raise ConflictError(
                "Unable to start Stripe Checkout for this invoice.",
                details={"reason": "stripe_checkout_create_failed"},
            ) from None

        payment = await self.authority.attach_checkout_session(
            payment_id=payment.id,
            checkout_session_id=session["id"],
            provider_payment_id=session.get("payment_intent"),
        )
        return InvoiceCheckoutSession(
            payment_id=payment.id,
            checkout_session_id=session["id"],
            checkout_url=session["url"],
            amount=amount,
            currency=currency,
            reused=False,
        )

    async def _try_reuse_open_session(
        self,
        *,
        existing: Payment,
        connected_account_id: str,
        api_key: str,
    ) -> InvoiceCheckoutSession | None:
        stripe = stripe_module(api_key=api_key)
        try:
            session = stripe.checkout.Session.retrieve(
                existing.provider_checkout_session_id,
                **connected_account_options(connected_account_id),
            )
        except Exception:
            return None
        status = session.get("status") if isinstance(session, dict) else getattr(session, "status", None)
        url = session.get("url") if isinstance(session, dict) else getattr(session, "url", None)
        session_id = (
            session.get("id") if isinstance(session, dict) else getattr(session, "id", None)
        )
        if status != "open" or not url or not session_id:
            return None
        return InvoiceCheckoutSession(
            payment_id=existing.id,
            checkout_session_id=str(session_id),
            checkout_url=str(url),
            amount=quantize_money(existing.amount),
            currency=existing.currency,
            reused=True,
        )

    def _create_stripe_session(
        self,
        *,
        api_key: str,
        connected_account_id: str,
        company_id: uuid.UUID,
        invoice_id: uuid.UUID,
        payment_id: uuid.UUID,
        amount: Decimal,
        currency: str,
        idempotency_key: str,
        success_path: str | None,
        cancel_path: str | None,
    ) -> dict:
        if amount <= 0:
            raise ValidationError("Checkout amount must be greater than zero.")
        frontend = settings.FRONTEND_URL.rstrip("/")
        success = success_path or f"/finance/invoices/{invoice_id}?checkout=success"
        cancel = cancel_path or f"/finance/invoices/{invoice_id}?checkout=cancel"
        if not success.startswith("/"):
            raise ValidationError("success_path must be a relative path.")
        if not cancel.startswith("/"):
            raise ValidationError("cancel_path must be a relative path.")

        stripe = stripe_module(api_key=api_key)
        # Direct charge on the connected account — deliberately no application fee.
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=f"{frontend}{success}&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend}{cancel}",
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": currency.lower(),
                        "unit_amount": to_minor_units(amount, currency),
                        "product_data": {
                            "name": "Invoice payment",
                            "metadata": {
                                "invoice_id": str(invoice_id),
                                "payment_id": str(payment_id),
                            },
                        },
                    },
                }
            ],
            client_reference_id=str(payment_id),
            metadata={
                "domain": "tenant_payments",
                "company_id": str(company_id),
                "invoice_id": str(invoice_id),
                "payment_id": str(payment_id),
            },
            payment_intent_data={
                "metadata": {
                    "domain": "tenant_payments",
                    "company_id": str(company_id),
                    "invoice_id": str(invoice_id),
                    "payment_id": str(payment_id),
                },
            },
            idempotency_key=idempotency_key,
            **connected_account_options(connected_account_id),
        )
        payment_intent = (
            session.get("payment_intent")
            if isinstance(session, dict)
            else getattr(session, "payment_intent", None)
        )
        return {
            "id": session["id"] if isinstance(session, dict) else session.id,
            "url": session["url"] if isinstance(session, dict) else session.url,
            "payment_intent": str(payment_intent) if payment_intent else None,
        }

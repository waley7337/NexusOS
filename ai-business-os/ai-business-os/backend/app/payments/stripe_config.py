"""Centralized Stripe enablement + secret resolution (fail closed)."""
from __future__ import annotations

from typing import Any

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError, ValidationError
from app.models.enums import PlatformPlan


def _secret(value: Any | None) -> str | None:
    if value is None:
        return None
    if hasattr(value, "get_secret_value"):
        resolved = value.get_secret_value()
        return resolved or None
    text = str(value).strip()
    return text or None


def platform_secret_key() -> str | None:
    return _secret(settings.STRIPE_PLATFORM_SECRET_KEY)


def platform_webhook_secret() -> str | None:
    return _secret(settings.STRIPE_PLATFORM_WEBHOOK_SECRET)


def connect_webhook_secret() -> str | None:
    return _secret(settings.STRIPE_CONNECT_WEBHOOK_SECRET)


def tenant_payments_live() -> bool:
    """True only when tenant Checkout is explicitly enabled and keyed."""
    return bool(settings.STRIPE_TENANT_PAYMENTS_ENABLED and platform_secret_key())


def billing_live() -> bool:
    """True only when NexusOS SaaS Billing is explicitly enabled and keyed."""
    return bool(settings.STRIPE_BILLING_ENABLED and platform_secret_key())


def require_tenant_payments_enabled() -> str:
    if not settings.STRIPE_TENANT_PAYMENTS_ENABLED:
        raise ServiceUnavailableError(
            "Tenant card payments are not enabled.",
            details={"reason": "stripe_tenant_payments_disabled"},
        )
    key = platform_secret_key()
    if not key:
        raise ServiceUnavailableError(
            "Tenant card payments are not configured.",
            details={"reason": "stripe_credentials_missing"},
        )
    return key


def require_billing_enabled() -> str:
    if not settings.STRIPE_BILLING_ENABLED:
        raise ServiceUnavailableError(
            "Platform billing is not enabled.",
            details={"reason": "stripe_billing_disabled"},
        )
    key = platform_secret_key()
    if not key:
        raise ServiceUnavailableError(
            "Platform billing is not configured.",
            details={"reason": "stripe_credentials_missing"},
        )
    return key


def require_platform_webhook_secret() -> str:
    secret = platform_webhook_secret()
    if not secret:
        raise ServiceUnavailableError(
            "Platform webhook secret is not configured.",
            details={"reason": "stripe_webhook_secret_missing"},
        )
    return secret


def require_connect_webhook_secret() -> str:
    secret = connect_webhook_secret()
    if not secret:
        raise ServiceUnavailableError(
            "Connect webhook secret is not configured.",
            details={"reason": "stripe_connect_webhook_secret_missing"},
        )
    return secret


_PLAN_PRICE_ATTR: dict[PlatformPlan, str] = {
    PlatformPlan.STARTER: "STRIPE_PRICE_STARTER",
    PlatformPlan.PRO: "STRIPE_PRICE_PRO",
    PlatformPlan.ENTERPRISE: "STRIPE_PRICE_ENTERPRISE",
}


def price_id_for_plan(plan: PlatformPlan) -> str:
    """Server-controlled plan → Stripe Price ID. Never trust client price IDs."""
    if plan == PlatformPlan.FREE:
        raise ValidationError(
            "The free plan does not require checkout.",
            details={"reason": "plan_not_billable"},
        )
    attr = _PLAN_PRICE_ATTR.get(plan)
    if attr is None:
        raise ValidationError("Unsupported billing plan.", details={"reason": "plan_unknown"})
    price_id = getattr(settings, attr, None)
    if not price_id or not str(price_id).strip():
        raise ServiceUnavailableError(
            "Billing price is not configured for this plan.",
            details={"reason": "stripe_price_unconfigured", "plan": plan.value},
        )
    return str(price_id).strip()


def plan_for_price_id(price_id: str) -> PlatformPlan | None:
    normalized = price_id.strip()
    for plan, attr in _PLAN_PRICE_ATTR.items():
        configured = getattr(settings, attr, None)
        if configured and str(configured).strip() == normalized:
            return plan
    return None


def http_timeout_seconds() -> float:
    return float(settings.STRIPE_HTTP_TIMEOUT_SECONDS)

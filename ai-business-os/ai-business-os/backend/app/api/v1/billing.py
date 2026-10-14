"""NexusOS SaaS subscription billing API (platform Stripe account)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, status

from app.core.exceptions import ValidationError
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.db.session import get_db
from app.models.enums import PlatformPlan
from app.payments.platform.billing_service import CheckoutUiMode, PlatformBillingService
from app.payments.stripe_config import billing_live
from app.schemas.billing import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingCheckoutSessionStatusResponse,
    BillingPlanPrice,
    BillingPlansResponse,
    BillingPortalResponse,
    BillingStatusResponse,
)
from app.schemas.response import ApiResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/billing", tags=["Platform Billing"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

_UI_MODES: frozenset[str] = frozenset({"hosted", "elements"})


def _idempotency_key(value: str) -> str:
    key = value.strip()
    if not key:
        raise ValidationError("Idempotency-Key must not be blank.")
    if len(key) > 255:
        raise ValidationError("Idempotency-Key must be at most 255 characters.")
    return key


def _status_payload(service: PlatformBillingService, profile) -> dict:
    return {
        "plan": profile.plan,
        "status": profile.status,
        "entitled": service.is_entitled(profile),
        "cancelAtPeriodEnd": profile.cancel_at_period_end,
        "currentPeriodStart": profile.current_period_start,
        "currentPeriodEnd": profile.current_period_end,
        "trialEndsAt": profile.trial_ends_at,
        "stripeCustomerLinked": bool(profile.stripe_customer_id),
        "billingEnabled": billing_live(),
    }


@router.get(
    "/subscription",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def get_subscription_status(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[BillingStatusResponse]:
    service = PlatformBillingService(db, company_id=user.company_id)
    profile = await service.get_profile()
    return ApiResponse.ok(
        data=BillingStatusResponse.model_validate(_status_payload(service, profile))
    )


@router.get(
    "/plans",
    dependencies=[Depends(require_permission("settings.view"))],
)
async def list_billing_plans(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[BillingPlansResponse]:
    """Trusted Stripe Price snapshots for checkout UI — amounts never come from the client."""
    service = PlatformBillingService(db, company_id=user.company_id)
    catalog = await service.list_plan_catalog()
    return ApiResponse.ok(
        data=BillingPlansResponse.model_validate(
            {
                "billingEnabled": catalog.billing_enabled,
                "publishableKey": catalog.publishable_key,
                "plans": [
                    BillingPlanPrice.model_validate(
                        {
                            "plan": item.plan,
                            "priceId": item.price_id,
                            "currency": item.currency,
                            "unitAmount": item.unit_amount,
                            "interval": item.interval,
                            "intervalCount": item.interval_count,
                            "productName": item.product_name,
                            "configured": item.configured,
                        }
                    )
                    for item in catalog.plans
                ],
            }
        )
    )


@router.post(
    "/checkout",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("settings.manage"))],
)
async def create_billing_checkout(
    payload: BillingCheckoutRequest,
    db: DbSession,
    user: ActiveUser,
    idempotency_header: Annotated[
        str, Header(alias="Idempotency-Key", min_length=1, max_length=255)
    ],
) -> ApiResponse[BillingCheckoutResponse]:
    if payload.plan == PlatformPlan.FREE:
        raise ValidationError(
            "The free plan does not require checkout.",
            details={"reason": "plan_not_billable"},
        )
    ui_mode_raw = (payload.ui_mode or "hosted").strip().lower()
    if ui_mode_raw not in _UI_MODES:
        raise ValidationError(
            "Unsupported checkout UI mode.",
            details={"reason": "checkout_ui_mode_invalid"},
        )
    ui_mode: CheckoutUiMode = ui_mode_raw  # type: ignore[assignment]
    service = PlatformBillingService(db, company_id=user.company_id)
    session = await service.create_checkout(
        plan=payload.plan,
        idempotency_key=_idempotency_key(idempotency_header),
        ui_mode=ui_mode,
    )
    message = (
        "Subscription plan updated."
        if session.mode == "subscription_updated"
        else "Billing checkout session created."
    )
    return ApiResponse.ok(
        data=BillingCheckoutResponse.model_validate(
            {
                "checkoutUrl": session.checkout_url,
                "checkoutSessionId": session.checkout_session_id,
                "clientSecret": session.client_secret,
                "publishableKey": session.publishable_key,
                "plan": session.plan,
                "mode": session.mode,
                "uiMode": session.ui_mode,
            }
        ),
        message=message,
    )


@router.get(
    "/checkout/session",
    dependencies=[Depends(require_permission("settings.manage"))],
)
async def get_billing_checkout_session(
    db: DbSession,
    user: ActiveUser,
    session_id: Annotated[str, Query(alias="sessionId", min_length=3, max_length=255)],
) -> ApiResponse[BillingCheckoutSessionStatusResponse]:
    """Read-only session status for the Elements return page — does not grant entitlements."""
    service = PlatformBillingService(db, company_id=user.company_id)
    result = await service.get_checkout_session_status(checkout_session_id=session_id)
    return ApiResponse.ok(
        data=BillingCheckoutSessionStatusResponse.model_validate(
            {
                "status": result.status,
                "paymentStatus": result.payment_status,
                "plan": result.plan,
                "checkoutSessionId": result.checkout_session_id,
            }
        )
    )


@router.post(
    "/portal",
    dependencies=[Depends(require_permission("settings.manage"))],
)
async def create_billing_portal(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[BillingPortalResponse]:
    service = PlatformBillingService(db, company_id=user.company_id)
    session = await service.create_portal()
    return ApiResponse.ok(
        data=BillingPortalResponse.model_validate({"portalUrl": session.portal_url}),
        message="Billing portal session created.",
    )


@router.post(
    "/cancel",
    dependencies=[Depends(require_permission("settings.manage"))],
)
async def cancel_subscription(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[BillingStatusResponse]:
    service = PlatformBillingService(db, company_id=user.company_id)
    profile = await service.cancel_at_period_end()
    return ApiResponse.ok(
        data=BillingStatusResponse.model_validate(_status_payload(service, profile)),
        message="Subscription will cancel at period end.",
    )

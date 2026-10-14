"""NexusOS SaaS subscription billing API (platform Stripe account)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

from app.core.exceptions import ValidationError
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.db.session import get_db
from app.models.enums import PlatformPlan
from app.payments.platform.billing_service import PlatformBillingService
from app.payments.stripe_config import billing_live
from app.schemas.billing import (
    BillingCheckoutRequest,
    BillingCheckoutResponse,
    BillingPortalResponse,
    BillingStatusResponse,
)
from app.schemas.response import ApiResponse
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/billing", tags=["Platform Billing"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def _idempotency_key(value: str) -> str:
    key = value.strip()
    if not key:
        raise ValidationError("Idempotency-Key must not be blank.")
    if len(key) > 255:
        raise ValidationError("Idempotency-Key must be at most 255 characters.")
    return key


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
        data=BillingStatusResponse.model_validate(
            {
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
    service = PlatformBillingService(db, company_id=user.company_id)
    session = await service.create_checkout(
        plan=payload.plan,
        idempotency_key=_idempotency_key(idempotency_header),
    )
    return ApiResponse.ok(
        data=BillingCheckoutResponse.model_validate(
            {
                "checkoutUrl": session.checkout_url,
                "checkoutSessionId": session.checkout_session_id,
                "plan": session.plan,
            }
        ),
        message="Billing checkout session created.",
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
        data=BillingStatusResponse.model_validate(
            {
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
        ),
        message="Subscription will cancel at period end.",
    )

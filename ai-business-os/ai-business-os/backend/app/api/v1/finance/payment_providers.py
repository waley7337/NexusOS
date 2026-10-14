"""Stripe Connect payment-provider onboarding for tenant invoice payments."""
from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.dependencies.auth import require_permission
from app.dependencies.finance import ActiveUser, DbSession
from app.payments.stripe_config import tenant_payments_live
from app.payments.tenant.connect_service import TenantConnectService
from app.schemas.billing import ConnectOnboardingResponse, ConnectStatusResponse
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/payment-providers", tags=["Payment Providers"])


@router.get(
    "/stripe",
    dependencies=[Depends(require_permission("payment_providers.read"))],
)
async def get_stripe_connect_status(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[ConnectStatusResponse]:
    service = TenantConnectService(db, company_id=user.company_id, user_id=user.id)
    status_row = await service.get_status()
    return ApiResponse.ok(
        data=ConnectStatusResponse.model_validate(
            {
                "accountId": status_row.account_id,
                "externalAccountId": status_row.external_account_id,
                "connectionStatus": status_row.connection_status,
                "chargesEnabled": status_row.charges_enabled,
                "payoutsEnabled": status_row.payouts_enabled,
                "onboardingCompletedAt": status_row.onboarding_completed_at,
                "paymentsEnabled": tenant_payments_live(),
            }
        )
    )


@router.post(
    "/stripe/onboarding",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("payment_providers.manage"))],
)
async def start_stripe_connect_onboarding(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[ConnectOnboardingResponse]:
    service = TenantConnectService(db, company_id=user.company_id, user_id=user.id)
    link = await service.start_onboarding()
    return ApiResponse.ok(
        data=ConnectOnboardingResponse.model_validate(
            {
                "accountId": link.account_id,
                "externalAccountId": link.external_account_id,
                "onboardingUrl": link.onboarding_url,
                "connectionStatus": link.connection_status,
                "chargesEnabled": link.charges_enabled,
                "payoutsEnabled": link.payouts_enabled,
            }
        ),
        message="Connect onboarding link created.",
    )


@router.post(
    "/stripe/sync",
    dependencies=[Depends(require_permission("payment_providers.manage"))],
)
async def sync_stripe_connect_account(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[ConnectStatusResponse]:
    service = TenantConnectService(db, company_id=user.company_id, user_id=user.id)
    account = await service.repo.get_active_stripe()
    if account is not None:
        await service.sync_account(account)
    status_row = await service.get_status()
    return ApiResponse.ok(
        data=ConnectStatusResponse.model_validate(
            {
                "accountId": status_row.account_id,
                "externalAccountId": status_row.external_account_id,
                "connectionStatus": status_row.connection_status,
                "chargesEnabled": status_row.charges_enabled,
                "payoutsEnabled": status_row.payouts_enabled,
                "onboardingCompletedAt": status_row.onboarding_completed_at,
                "paymentsEnabled": tenant_payments_live(),
            }
        ),
        message="Connect account synced.",
    )

"""Inventory Stock API — tenant-scoped stock level reads and atomic adjustments.

NOTE: There is no ``stock_movements`` table in the current schema.  The
``reason`` field on POST /inventory/stock/adjust is persisted in the audit
log only (``audit_service.record``).  Future work: add a
``stock_movements`` table and migrate the audit-only record to a queryable
history row without changing this API surface.

Permissions: inventory.read (GET /stock), inventory.manage (POST /stock/adjust).

Key invariants enforced here:
  * Stock quantity can never go below 0 (validated atomically in the
    repository using SELECT FOR UPDATE).
  * Direct PATCH of quantity is not exposed — all mutations go through
    /adjust so every change has a reason and an audit entry.
  * The product and warehouse referenced by an adjustment must belong to
    the caller's tenant (validated before locking).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.client_ip import resolve_client_identity
from app.dependencies.auth import require_permission
from app.dependencies.inventory import (
    ActiveUser,
    DbSession,
    ProductRepo,
    StockRepo,
    WarehouseRepo,
)
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.inventory import StockAdjustRequest, StockLevelResponse
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service
from app.models.inventory import StockLevel

router = APIRouter(prefix="/stock", tags=["Inventory — Stock"])


def _to_response(stock: StockLevel) -> StockLevelResponse:
    return StockLevelResponse.model_validate(stock)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.get(
    "",
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def list_stock(
    repo: StockRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
    product_id: Annotated[uuid.UUID | None, Query(alias="productId")] = None,
    warehouse_id: Annotated[uuid.UUID | None, Query(alias="warehouseId")] = None,
    low_stock: Annotated[bool, Query(alias="lowStock")] = False,
) -> ApiResponse[Paginated[StockLevelResponse]]:
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        product_id=product_id,
        warehouse_id=warehouse_id,
        low_stock=low_stock,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[_to_response(s) for s in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "/adjust",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("inventory.manage"))],
)
async def adjust_stock(
    payload: StockAdjustRequest,
    stock_repo: StockRepo,
    product_repo: ProductRepo,
    warehouse_repo: WarehouseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[StockLevelResponse]:
    # Validate that both product and warehouse belong to the current tenant
    # before acquiring the row lock.
    await product_repo.ensure_product_in_tenant(payload.product_id)
    await warehouse_repo.ensure_warehouse_in_tenant(payload.warehouse_id)

    stock = await stock_repo.adjust(
        product_id=payload.product_id,
        warehouse_id=payload.warehouse_id,
        delta=payload.delta,
        company_id=user.company_id,
    )

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="stock.adjusted",
        entity="inventory",
        entity_id=stock.id,
        new_values={
            "product_id": str(payload.product_id),
            "warehouse_id": str(payload.warehouse_id),
            "delta": str(payload.delta),
            "new_quantity": str(stock.quantity),
            "reason": payload.reason,
        },
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(stock), message="Stock adjusted.")

"""Inventory Warehouses API — tenant-scoped warehouse CRUD.

Permissions: inventory.read (list/detail), inventory.manage (create/update/delete).
Warehouse name uniqueness per tenant is enforced by a partial unique index
(deleted_at IS NULL); duplicates surface as ValidationError (422).
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.inventory import ActiveUser, DbSession, WarehouseRepo
from app.models.inventory import Warehouse
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.inventory import WarehouseCreate, WarehouseResponse, WarehouseUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/warehouses", tags=["Inventory — Warehouses"])


def _to_response(warehouse: Warehouse) -> WarehouseResponse:
    return WarehouseResponse.model_validate(warehouse)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.get(
    "",
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def list_warehouses(
    repo: WarehouseRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    search: Annotated[str | None, Query()] = None,
) -> ApiResponse[Paginated[WarehouseResponse]]:
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        search=search,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[_to_response(w) for w in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("inventory.manage"))],
)
async def create_warehouse(
    payload: WarehouseCreate,
    repo: WarehouseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[WarehouseResponse]:
    data = payload.model_dump()
    try:
        created = await repo.create(Warehouse(**data))
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "A warehouse with this name already exists for your company."
        )

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="warehouse.created",
        entity="warehouses",
        entity_id=created.id,
        new_values={"name": created.name, "address": created.address},
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(created), message="Warehouse created.")


@router.get(
    "/{warehouse_id}",
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def get_warehouse(
    warehouse_id: uuid.UUID,
    repo: WarehouseRepo,
) -> ApiResponse[WarehouseResponse]:
    warehouse = await repo.get(warehouse_id)
    return ApiResponse.ok(data=_to_response(warehouse))


@router.patch(
    "/{warehouse_id}",
    dependencies=[Depends(require_permission("inventory.manage"))],
)
async def update_warehouse(
    warehouse_id: uuid.UUID,
    payload: WarehouseUpdate,
    repo: WarehouseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[WarehouseResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    existing = await repo.get(warehouse_id)
    old_snapshot = {k: getattr(existing, k) for k in values}

    try:
        updated = await repo.update(warehouse_id, values)
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "A warehouse with this name already exists for your company."
        )

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="warehouse.updated",
        entity="warehouses",
        entity_id=updated.id,
        old_values={k: str(v) if v is not None else None for k, v in old_snapshot.items()},
        new_values={k: str(getattr(updated, k)) if getattr(updated, k) is not None else None for k in values},
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(updated), message="Warehouse updated.")


@router.delete(
    "/{warehouse_id}",
    dependencies=[Depends(require_permission("inventory.manage"))],
)
async def delete_warehouse(
    warehouse_id: uuid.UUID,
    repo: WarehouseRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(warehouse_id)
    await repo.soft_delete(warehouse_id)

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="warehouse.deleted",
        entity="warehouses",
        entity_id=warehouse_id,
        old_values={"name": existing.name},
        new_values={"deleted": True},
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(message="Warehouse deleted.")

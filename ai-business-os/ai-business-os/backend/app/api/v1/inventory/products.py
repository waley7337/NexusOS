"""Inventory Products API — tenant-scoped product catalogue CRUD.

Permissions: inventory.read (list/detail), inventory.manage (create/update/delete).
SKU uniqueness is enforced via a partial unique index in the DB; duplicate
active SKUs raise IntegrityError which is caught here and surfaced as
ValidationError (422).
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
from app.dependencies.inventory import ActiveUser, DbSession, ProductRepo
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.inventory import ProductCreate, ProductResponse, ProductUpdate
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service
from app.models.inventory import Product

router = APIRouter(prefix="/products", tags=["Inventory — Products"])


def _to_response(product: Product) -> ProductResponse:
    return ProductResponse.model_validate(product)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


@router.get(
    "",
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def list_products(
    repo: ProductRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    category: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> ApiResponse[Paginated[ProductResponse]]:
    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        category=category,
        search=search,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[_to_response(p) for p in items],
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
async def create_product(
    payload: ProductCreate,
    repo: ProductRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[ProductResponse]:
    data = payload.model_dump()
    try:
        created = await repo.create(Product(**data))
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "A product with this SKU already exists for your company. "
            "SKUs must be unique among active (non-deleted) products."
        )

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="product.created",
        entity="products",
        entity_id=created.id,
        new_values={"sku": created.sku, "name": created.name, "category": created.category},
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(created), message="Product created.")


@router.get(
    "/{product_id}",
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def get_product(
    product_id: uuid.UUID,
    repo: ProductRepo,
) -> ApiResponse[ProductResponse]:
    product = await repo.get(product_id)
    return ApiResponse.ok(data=_to_response(product))


@router.patch(
    "/{product_id}",
    dependencies=[Depends(require_permission("inventory.manage"))],
)
async def update_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    repo: ProductRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[ProductResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    existing = await repo.get(product_id)
    old_snapshot = {k: getattr(existing, k) for k in values}

    try:
        updated = await repo.update(product_id, values)
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "A product with this SKU already exists for your company. "
            "SKUs must be unique among active (non-deleted) products."
        )

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="product.updated",
        entity="products",
        entity_id=updated.id,
        old_values={k: str(v) if v is not None else None for k, v in old_snapshot.items()},
        new_values={k: str(getattr(updated, k)) if getattr(updated, k) is not None else None for k in values},
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(data=_to_response(updated), message="Product updated.")


@router.delete(
    "/{product_id}",
    dependencies=[Depends(require_permission("inventory.manage"))],
)
async def delete_product(
    product_id: uuid.UUID,
    repo: ProductRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(product_id)
    await repo.soft_delete(product_id)

    ip, ua = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="product.deleted",
        entity="products",
        entity_id=product_id,
        old_values={"sku": existing.sku, "name": existing.name},
        new_values={"deleted": True},
        ip_address=ip,
        user_agent=ua,
    )
    return ApiResponse.ok(message="Product deleted.")

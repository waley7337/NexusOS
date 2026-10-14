"""Inventory repositories — tenant-scoped products, warehouses, stock levels.

NOTE: There is no ``stock_movements`` table in the current schema, so
adjustment reasons are captured in the audit log only (via
``audit_service.record``).  A future migration can add a movements table
to give a queryable history without changing the public API surface.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import List

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import NotFoundError, ValidationError
from app.models.inventory import Product, StockLevel, Warehouse
from app.repositories.base import DEFAULT_PAGE_SIZE, BaseRepository


class ProductRepository(BaseRepository[Product]):
    model = Product
    SORT_FIELDS = {
        "created_at": Product.created_at,
        "name": Product.name,
        "sku": Product.sku,
        "category": Product.category,
        "price": Product.price,
    }

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        category: str | None = None,
        search: str | None = None,
    ) -> tuple[List[Product], int]:
        from sqlalchemy import func

        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if category is not None:
            stmt = stmt.where(Product.category == category)

        if search:
            term = search.strip()[:100]
            if term:
                pattern = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stmt = stmt.where(
                    Product.name.ilike(f"%{pattern}%", escape="\\")
                    | Product.sku.ilike(f"%{pattern}%", escape="\\")
                )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def ensure_product_in_tenant(self, product_id: uuid.UUID) -> Product:
        """Raise NotFoundError if the product is missing, soft-deleted, or
        belongs to a different tenant."""
        stmt = self._base_query().where(Product.id == product_id)
        result = await self.db.execute(stmt)
        product = result.scalar_one_or_none()
        if product is None:
            raise NotFoundError("Product not found.")
        return product


class WarehouseRepository(BaseRepository[Warehouse]):
    model = Warehouse
    SORT_FIELDS = {
        "created_at": Warehouse.created_at,
        "name": Warehouse.name,
    }

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        search: str | None = None,
    ) -> tuple[List[Warehouse], int]:
        from sqlalchemy import func

        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if search:
            term = search.strip()[:100]
            if term:
                pattern = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stmt = stmt.where(
                    Warehouse.name.ilike(f"%{pattern}%", escape="\\")
                )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def ensure_warehouse_in_tenant(self, warehouse_id: uuid.UUID) -> Warehouse:
        """Raise NotFoundError if the warehouse is missing, soft-deleted, or
        belongs to a different tenant."""
        stmt = self._base_query().where(Warehouse.id == warehouse_id)
        result = await self.db.execute(stmt)
        warehouse = result.scalar_one_or_none()
        if warehouse is None:
            raise NotFoundError("Warehouse not found.")
        return warehouse


class StockRepository(BaseRepository[StockLevel]):
    model = StockLevel
    SORT_FIELDS = {
        "created_at": StockLevel.created_at,
        "quantity": StockLevel.quantity,
    }

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        product_id: uuid.UUID | None = None,
        warehouse_id: uuid.UUID | None = None,
        low_stock: bool = False,
    ) -> tuple[List[StockLevel], int]:
        from sqlalchemy import func

        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if product_id is not None:
            stmt = stmt.where(StockLevel.product_id == product_id)
        if warehouse_id is not None:
            stmt = stmt.where(StockLevel.warehouse_id == warehouse_id)
        if low_stock:
            stmt = stmt.where(StockLevel.quantity <= StockLevel.minimum_quantity)

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(StockLevel.created_at.asc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def adjust(
        self,
        *,
        product_id: uuid.UUID,
        warehouse_id: uuid.UUID,
        delta: Decimal,
        company_id: uuid.UUID,
    ) -> StockLevel:
        """Atomically adjust stock quantity.

        * Uses SELECT FOR UPDATE to prevent concurrent race conditions.
        * Creates the stock row on first positive receipt; rejects negative
          adjustments to non-existent rows (cannot remove what isn't tracked).
        * Raises ValidationError if the resulting quantity would go below 0.
        """
        self._require_tenant_context()

        # Lock the existing row (if any) for this product×warehouse pair.
        stmt = (
            select(StockLevel)
            .where(
                StockLevel.product_id == product_id,
                StockLevel.warehouse_id == warehouse_id,
                StockLevel.company_id == company_id,
            )
            .with_for_update()
        )
        result = await self.db.execute(stmt)
        stock: StockLevel | None = result.scalar_one_or_none()

        if stock is None:
            if delta <= 0:
                raise ValidationError(
                    "Cannot remove stock: no stock record exists for this "
                    "product / warehouse combination. Receive positive stock first."
                )
            stock = StockLevel(
                company_id=company_id,
                product_id=product_id,
                warehouse_id=warehouse_id,
                quantity=delta,
                minimum_quantity=Decimal("0"),
            )
            if self.user_id is not None:
                stock.created_by = self.user_id
                stock.updated_by = self.user_id
            self.db.add(stock)
            await self.db.flush()
            await self.db.refresh(stock)
            return stock

        new_qty = Decimal(str(stock.quantity)) + delta
        if new_qty < 0:
            raise ValidationError(
                f"Adjustment would result in negative stock ({new_qty}). "
                "Operation rejected — adjust the delta or verify current quantity."
            )

        stock.quantity = new_qty
        if self.user_id is not None:
            stock.updated_by = self.user_id
        await self.db.flush()
        await self.db.refresh(stock)
        return stock

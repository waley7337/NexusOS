"""Inventory FastAPI dependency helpers — trusted tenant context → repositories."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.repositories.inventory import ProductRepository, StockRepository, WarehouseRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


def get_product_repository(db: DbSession, user: ActiveUser) -> ProductRepository:
    return ProductRepository(db, company_id=user.company_id, user_id=user.id)


def get_warehouse_repository(db: DbSession, user: ActiveUser) -> WarehouseRepository:
    return WarehouseRepository(db, company_id=user.company_id, user_id=user.id)


def get_stock_repository(db: DbSession, user: ActiveUser) -> StockRepository:
    return StockRepository(db, company_id=user.company_id, user_id=user.id)


ProductRepo = Annotated[ProductRepository, Depends(get_product_repository)]
WarehouseRepo = Annotated[WarehouseRepository, Depends(get_warehouse_repository)]
StockRepo = Annotated[StockRepository, Depends(get_stock_repository)]

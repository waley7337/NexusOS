"""Inventory API router package — Products, Warehouses, Stock."""
from fastapi import APIRouter

from app.api.v1.inventory import products, stock, warehouses

router = APIRouter(prefix="/inventory", tags=["Inventory"])
router.include_router(products.router)
router.include_router(warehouses.router)
router.include_router(stock.router)

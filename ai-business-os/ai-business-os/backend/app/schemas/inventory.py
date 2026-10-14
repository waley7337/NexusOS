"""Inventory request/response schemas — Products, Warehouses, Stock Levels.

Snake_case in Python, camelCase on the wire via explicit Field aliases
(same convention as CRM / HR / Finance modules).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import Field, field_validator

from app.schemas.base import CamelModel


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

class ProductCreate(CamelModel):
    sku: str = Field(min_length=1, max_length=60)
    barcode: str | None = Field(default=None, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    cost: Decimal | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    unit: str = Field(default="pcs", max_length=20)

    @field_validator("cost", "price", mode="before")
    @classmethod
    def _coerce_decimal(cls, v: object) -> Decimal | None:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return v
        return Decimal(str(v))


class ProductUpdate(CamelModel):
    sku: str | None = Field(default=None, min_length=1, max_length=60)
    barcode: str | None = Field(default=None, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, max_length=100)
    cost: Decimal | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=20)

    @field_validator("cost", "price", mode="before")
    @classmethod
    def _coerce_decimal(cls, v: object) -> Decimal | None:
        if v is None:
            return None
        if isinstance(v, Decimal):
            return v
        return Decimal(str(v))


class ProductResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    sku: str
    barcode: str | None = None
    name: str
    description: str | None = None
    category: str | None = None
    cost: Decimal | None = None
    price: Decimal | None = None
    unit: str
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


# ---------------------------------------------------------------------------
# Warehouse
# ---------------------------------------------------------------------------

class WarehouseCreate(CamelModel):
    name: str = Field(min_length=1, max_length=150)
    address: str | None = Field(default=None, max_length=255)


class WarehouseUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    address: str | None = Field(default=None, max_length=255)


class WarehouseResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    name: str
    address: str | None = None
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    created_by: uuid.UUID | None = Field(default=None, alias="createdBy")
    updated_by: uuid.UUID | None = Field(default=None, alias="updatedBy")
    deleted_at: datetime | None = Field(default=None, alias="deletedAt")


# ---------------------------------------------------------------------------
# Stock Level
# ---------------------------------------------------------------------------

class StockLevelResponse(CamelModel):
    id: uuid.UUID
    company_id: uuid.UUID = Field(alias="companyId")
    warehouse_id: uuid.UUID = Field(alias="warehouseId")
    product_id: uuid.UUID = Field(alias="productId")
    quantity: Decimal
    minimum_quantity: Decimal = Field(alias="minimumQuantity")
    is_active: bool = Field(alias="isActive")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class StockAdjustRequest(CamelModel):
    product_id: uuid.UUID = Field(alias="productId")
    warehouse_id: uuid.UUID = Field(alias="warehouseId")
    delta: Decimal
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("delta", mode="before")
    @classmethod
    def _coerce_decimal(cls, v: object) -> Decimal:
        if isinstance(v, Decimal):
            return v
        return Decimal(str(v))

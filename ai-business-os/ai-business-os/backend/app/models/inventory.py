"""Inventory: products, warehouses, stock levels, suppliers, purchase orders."""
import uuid
from datetime import date

from sqlalchemy import (
    Date, Enum, ForeignKey, ForeignKeyConstraint, Index, Numeric, String,
    Text, UniqueConstraint, text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantBusinessMixin
from app.models.enums import PurchaseOrderStatus


class Product(Base, TenantBusinessMixin):
    __tablename__ = "products"
    __table_args__ = (
        # Partial unique index: a discontinued/soft-deleted product must
        # free its SKU for reuse.
        Index(
            "ix_products_company_sku_active_uq", "company_id", "sku",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        Index("ix_products_company_category", "company_id", "category"),
        # Composite-FK anchor for StockLevel.product_id (below).
        UniqueConstraint("id", "company_id", name="uq_products_id_company"),
    )

    sku: Mapped[str] = mapped_column(String(60), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    cost: Mapped[float | None] = mapped_column(Numeric(14, 2))
    price: Mapped[float | None] = mapped_column(Numeric(14, 2))
    unit: Mapped[str] = mapped_column(String(20), default="pcs", nullable=False)

    stock_levels: Mapped[list["StockLevel"]] = relationship(
        back_populates="product", foreign_keys="StockLevel.product_id"
    )


class Warehouse(Base, TenantBusinessMixin):
    __tablename__ = "warehouses"
    __table_args__ = (
        Index(
            "ix_warehouses_company_name_active_uq", "company_id", "name",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        # Composite-FK anchor for StockLevel.warehouse_id (below).
        UniqueConstraint("id", "company_id", name="uq_warehouses_id_company"),
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(String(255))


class StockLevel(Base, TenantBusinessMixin):
    """Table name 'inventory' per spec; one row = product × warehouse."""

    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "product_id", name="uq_inventory_warehouse_product"),
        ForeignKeyConstraint(
            ["warehouse_id", "company_id"], ["warehouses.id", "warehouses.company_id"],
            name="fk_inventory_warehouse_id_tenant_scoped", ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["product_id", "company_id"], ["products.id", "products.company_id"],
            name="fk_inventory_product_id_tenant_scoped", ondelete="CASCADE",
        ),
    )

    warehouse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    minimum_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    product: Mapped["Product"] = relationship(
        back_populates="stock_levels", foreign_keys=[product_id]
    )


class Supplier(Base, TenantBusinessMixin):
    __tablename__ = "suppliers"
    __table_args__ = (
        Index(
            "ix_suppliers_company_name_active_uq", "company_id", "name",
            unique=True, postgresql_where=text("deleted_at IS NULL"),
        ),
        # Composite-FK anchor for PurchaseOrder.supplier_id (below).
        UniqueConstraint("id", "company_id", name="uq_suppliers_id_company"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(255))


class PurchaseOrder(Base, TenantBusinessMixin):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        Index("ix_purchase_orders_company_status", "company_id", "status"),
        ForeignKeyConstraint(
            ["supplier_id", "company_id"], ["suppliers.id", "suppliers.company_id"],
            name="fk_purchase_orders_supplier_id_tenant_scoped", ondelete="RESTRICT",
        ),
    )

    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus, native_enum=False, length=15),
        default=PurchaseOrderStatus.DRAFT, nullable=False,
    )
    expected_delivery: Mapped[date | None] = mapped_column(Date)
    total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

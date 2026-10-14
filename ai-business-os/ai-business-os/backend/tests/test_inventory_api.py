"""Inventory API — integration tests.

Covers: Product CRUD, Warehouse CRUD, Stock adjust, SKU uniqueness,
tenant isolation, zero-stock constraint, permission enforcement.
Requires a running PostgreSQL database. Skip with SKIP_DB_TESTS=1.
"""
from __future__ import annotations

import os
import uuid

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    os.environ.get("SKIP_DB_TESTS") == "1", reason="database not available"
)

from app.main import app  # noqa: E402

_EMAIL_DOMAIN = "inventoryapitest.example.com"
_PRODUCTS = "/api/v1/inventory/products"
_WAREHOUSES = "/api/v1/inventory/warehouses"
_STOCK = "/api/v1/inventory/stock"
_STOCK_ADJUST = "/api/v1/inventory/stock/adjust"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _unique_email(tag: str) -> str:
    return f"{tag}-{os.urandom(4).hex()}@{_EMAIL_DOMAIN}"


def _register(client: TestClient, tag: str) -> dict:
    email = _unique_email(tag)
    password = "Inventory1234!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "companyName": f"InvCo {tag}",
            "firstName": "Inv",
            "lastName": tag.title(),
            "email": email,
            "password": password,
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()["data"]
    return {
        "email": email,
        "password": password,
        "token": data["accessToken"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['accessToken']}"},
    }


def _make_product(client: TestClient, headers: dict, sku_suffix: str = "") -> str:
    sku = f"SKU-{os.urandom(3).hex()}{sku_suffix}"
    res = client.post(
        _PRODUCTS,
        headers=headers,
        json={"sku": sku, "name": f"Product {sku}", "unit": "pcs"},
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


def _make_warehouse(client: TestClient, headers: dict) -> str:
    name = f"Warehouse-{os.urandom(3).hex()}"
    res = client.post(
        _WAREHOUSES, headers=headers, json={"name": name}
    )
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


# ---------------------------------------------------------------------------
# Product CRUD
# ---------------------------------------------------------------------------

class TestProductCRUD:
    def test_create_product(self, client: TestClient):
        user = _register(client, "prod-create")
        sku = f"WIDGET-{os.urandom(3).hex()}"
        res = client.post(
            _PRODUCTS,
            headers=user["headers"],
            json={
                "sku": sku,
                "name": "Widget Pro",
                "category": "Electronics",
                "price": "9.99",
                "cost": "5.00",
                "unit": "pcs",
            },
        )
        assert res.status_code == 201, res.text
        data = res.json()["data"]
        assert data["sku"] == sku
        assert data["name"] == "Widget Pro"
        assert data["category"] == "Electronics"
        assert data["isActive"] is True
        assert data["companyId"] == user["user"]["companyId"]

    def test_list_products(self, client: TestClient):
        user = _register(client, "prod-list")
        for _ in range(3):
            _make_product(client, user["headers"])
        res = client.get(_PRODUCTS, headers=user["headers"])
        assert res.status_code == 200
        assert res.json()["data"]["total"] >= 3

    def test_get_product(self, client: TestClient):
        user = _register(client, "prod-get")
        pid = _make_product(client, user["headers"])
        res = client.get(f"{_PRODUCTS}/{pid}", headers=user["headers"])
        assert res.status_code == 200
        assert res.json()["data"]["id"] == pid

    def test_update_product(self, client: TestClient):
        user = _register(client, "prod-upd")
        pid = _make_product(client, user["headers"])
        res = client.patch(
            f"{_PRODUCTS}/{pid}",
            headers=user["headers"],
            json={"name": "Updated Widget", "price": "14.99"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["name"] == "Updated Widget"

    def test_delete_product(self, client: TestClient):
        user = _register(client, "prod-del")
        pid = _make_product(client, user["headers"])
        del_res = client.delete(f"{_PRODUCTS}/{pid}", headers=user["headers"])
        assert del_res.status_code == 200
        list_res = client.get(_PRODUCTS, headers=user["headers"])
        ids = [p["id"] for p in list_res.json()["data"]["items"]]
        assert pid not in ids

    def test_duplicate_active_sku_rejected(self, client: TestClient):
        """Two products with the same SKU in the same company must fail."""
        user = _register(client, "prod-dupsku")
        sku = f"DUPE-{os.urandom(3).hex()}"
        r1 = client.post(
            _PRODUCTS,
            headers=user["headers"],
            json={"sku": sku, "name": "Original", "unit": "pcs"},
        )
        assert r1.status_code == 201
        r2 = client.post(
            _PRODUCTS,
            headers=user["headers"],
            json={"sku": sku, "name": "Duplicate", "unit": "pcs"},
        )
        assert r2.status_code == 422  # IntegrityError surfaced as ValidationError

    def test_same_sku_different_tenants_ok(self, client: TestClient):
        """Same SKU is allowed for two different companies."""
        user_a = _register(client, "prod-ska")
        user_b = _register(client, "prod-skb")
        sku = f"CROSS-{os.urandom(3).hex()}"
        r_a = client.post(
            _PRODUCTS, headers=user_a["headers"],
            json={"sku": sku, "name": "PA", "unit": "pcs"},
        )
        r_b = client.post(
            _PRODUCTS, headers=user_b["headers"],
            json={"sku": sku, "name": "PB", "unit": "pcs"},
        )
        assert r_a.status_code == 201
        assert r_b.status_code == 201

    def test_filter_by_category(self, client: TestClient):
        user = _register(client, "prod-cat")
        sku_a = f"CAT-EL-{os.urandom(3).hex()}"
        sku_b = f"CAT-FN-{os.urandom(3).hex()}"
        client.post(
            _PRODUCTS, headers=user["headers"],
            json={"sku": sku_a, "name": "ElProd", "category": "Electronics", "unit": "pcs"},
        )
        client.post(
            _PRODUCTS, headers=user["headers"],
            json={"sku": sku_b, "name": "FnProd", "category": "Furniture", "unit": "pcs"},
        )
        res = client.get(
            f"{_PRODUCTS}?category=Electronics", headers=user["headers"]
        )
        assert res.status_code == 200
        items = res.json()["data"]["items"]
        assert all(p["category"] == "Electronics" for p in items)

    def test_product_not_found_returns_404(self, client: TestClient):
        user = _register(client, "prod-404")
        res = client.get(f"{_PRODUCTS}/{uuid.uuid4()}", headers=user["headers"])
        assert res.status_code == 404

    def test_unauthenticated_rejected(self, client: TestClient):
        res = client.get(_PRODUCTS)
        assert res.status_code == 401


# ---------------------------------------------------------------------------
# Warehouse CRUD
# ---------------------------------------------------------------------------

class TestWarehouseCRUD:
    def test_create_warehouse(self, client: TestClient):
        user = _register(client, "wh-create")
        name = f"Main-{os.urandom(3).hex()}"
        res = client.post(
            _WAREHOUSES,
            headers=user["headers"],
            json={"name": name, "address": "123 Dock St"},
        )
        assert res.status_code == 201, res.text
        data = res.json()["data"]
        assert data["name"] == name
        assert data["address"] == "123 Dock St"
        assert data["companyId"] == user["user"]["companyId"]

    def test_duplicate_name_same_company_rejected(self, client: TestClient):
        user = _register(client, "wh-dup")
        name = f"WH-{os.urandom(3).hex()}"
        r1 = client.post(
            _WAREHOUSES, headers=user["headers"], json={"name": name}
        )
        assert r1.status_code == 201
        r2 = client.post(
            _WAREHOUSES, headers=user["headers"], json={"name": name}
        )
        assert r2.status_code == 422

    def test_same_warehouse_name_different_tenants_ok(self, client: TestClient):
        user_a = _register(client, "wh-ta")
        user_b = _register(client, "wh-tb")
        name = f"WH-CROSS-{os.urandom(3).hex()}"
        assert client.post(
            _WAREHOUSES, headers=user_a["headers"], json={"name": name}
        ).status_code == 201
        assert client.post(
            _WAREHOUSES, headers=user_b["headers"], json={"name": name}
        ).status_code == 201

    def test_delete_warehouse(self, client: TestClient):
        user = _register(client, "wh-del")
        wid = _make_warehouse(client, user["headers"])
        res = client.delete(f"{_WAREHOUSES}/{wid}", headers=user["headers"])
        assert res.status_code == 200


# ---------------------------------------------------------------------------
# Stock
# ---------------------------------------------------------------------------

class TestStock:
    def test_stock_adjust_increase(self, client: TestClient):
        user = _register(client, "st-inc")
        pid = _make_product(client, user["headers"])
        wid = _make_warehouse(client, user["headers"])

        # Add 50 units
        res = client.post(
            _STOCK_ADJUST,
            headers=user["headers"],
            json={
                "productId": pid,
                "warehouseId": wid,
                "delta": "50",
                "reason": "Initial stock",
            },
        )
        assert res.status_code in (200, 201), res.text
        data = res.json()["data"]
        assert float(data["quantity"]) == 50.0

    def test_stock_adjust_creates_record_if_missing(self, client: TestClient):
        user = _register(client, "st-new")
        pid = _make_product(client, user["headers"])
        wid = _make_warehouse(client, user["headers"])

        res = client.post(
            _STOCK_ADJUST,
            headers=user["headers"],
            json={
                "productId": pid,
                "warehouseId": wid,
                "delta": "10",
                "reason": "Initial receipt",
            },
        )
        assert res.status_code in (200, 201)
        assert float(res.json()["data"]["quantity"]) == 10.0

    def test_stock_adjust_decrease(self, client: TestClient):
        user = _register(client, "st-dec")
        pid = _make_product(client, user["headers"])
        wid = _make_warehouse(client, user["headers"])
        # Prime with 20
        client.post(
            _STOCK_ADJUST,
            headers=user["headers"],
            json={"productId": pid, "warehouseId": wid, "delta": "20", "reason": "Prime"},
        )
        # Remove 8
        res = client.post(
            _STOCK_ADJUST,
            headers=user["headers"],
            json={"productId": pid, "warehouseId": wid, "delta": "-8", "reason": "Shipped"},
        )
        assert res.status_code in (200, 201)
        assert float(res.json()["data"]["quantity"]) == 12.0

    def test_stock_cannot_go_below_zero(self, client: TestClient):
        user = _register(client, "st-neg")
        pid = _make_product(client, user["headers"])
        wid = _make_warehouse(client, user["headers"])
        # No initial stock → try to remove 5
        res = client.post(
            _STOCK_ADJUST,
            headers=user["headers"],
            json={"productId": pid, "warehouseId": wid, "delta": "-5", "reason": "Overcommit"},
        )
        assert res.status_code == 422

    def test_stock_list_by_warehouse(self, client: TestClient):
        user = _register(client, "st-list")
        pid = _make_product(client, user["headers"])
        wid = _make_warehouse(client, user["headers"])
        client.post(
            _STOCK_ADJUST,
            headers=user["headers"],
            json={"productId": pid, "warehouseId": wid, "delta": "5", "reason": "load"},
        )
        res = client.get(
            f"{_STOCK}?warehouseId={wid}", headers=user["headers"]
        )
        assert res.status_code == 200
        items = res.json()["data"]["items"]
        assert any(s["productId"] == pid for s in items)

    def test_stock_adjust_cross_tenant_product_rejected(self, client: TestClient):
        user_a = _register(client, "st-ct-a")
        user_b = _register(client, "st-ct-b")
        pid_a = _make_product(client, user_a["headers"])
        wid_b = _make_warehouse(client, user_b["headers"])

        res = client.post(
            _STOCK_ADJUST,
            headers=user_b["headers"],
            json={
                "productId": pid_a,
                "warehouseId": wid_b,
                "delta": "10",
                "reason": "Cross-tenant attack",
            },
        )
        # product from tenant A doesn't exist in tenant B scope → 404
        assert res.status_code == 404


# ---------------------------------------------------------------------------
# Inventory tenant isolation
# ---------------------------------------------------------------------------

class TestInventoryTenantIsolation:
    def test_product_not_visible_cross_tenant(self, client: TestClient):
        user_a = _register(client, "inv-ta")
        user_b = _register(client, "inv-tb")
        pid_a = _make_product(client, user_a["headers"])

        res = client.get(f"{_PRODUCTS}/{pid_a}", headers=user_b["headers"])
        assert res.status_code == 404

        list_res = client.get(_PRODUCTS, headers=user_b["headers"])
        ids = [p["id"] for p in list_res.json()["data"]["items"]]
        assert pid_a not in ids

    def test_warehouse_not_visible_cross_tenant(self, client: TestClient):
        user_a = _register(client, "inv-wh-ta")
        user_b = _register(client, "inv-wh-tb")
        wid_a = _make_warehouse(client, user_a["headers"])

        res = client.get(f"{_WAREHOUSES}/{wid_a}", headers=user_b["headers"])
        assert res.status_code == 404

import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Product, ProductCreatePayload, ProductListParams, ProductUpdatePayload,
  StockAdjustPayload, StockLevel, StockListParams,
  Warehouse, WarehouseCreatePayload, WarehouseUpdatePayload,
} from "../types";

// ---- Products ----
const PRODUCTS_BASE = "/inventory/products";

function productsQuery(p: ProductListParams): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (p.page != null) q.page = p.page;
  if (p.pageSize != null) q.pageSize = p.pageSize;
  if (p.sortBy) q.sortBy = p.sortBy;
  if (p.sortDesc != null) q.sortDesc = p.sortDesc;
  if (p.search) q.search = p.search;
  if (p.isActive != null) q.isActive = p.isActive;
  if (p.category) q.category = p.category;
  return q;
}

export async function listProducts(
  params: ProductListParams = {}, signal?: AbortSignal,
): Promise<Paginated<Product>> {
  return request<Paginated<Product>>({ method: "GET", url: PRODUCTS_BASE, params: productsQuery(params), signal });
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  return request<Product>({ method: "GET", url: `${PRODUCTS_BASE}/${id}`, signal });
}

export async function createProduct(payload: ProductCreatePayload): Promise<Product> {
  return request<Product>({ method: "POST", url: PRODUCTS_BASE, data: payload });
}

export async function updateProduct(id: string, payload: ProductUpdatePayload): Promise<Product> {
  return request<Product>({ method: "PATCH", url: `${PRODUCTS_BASE}/${id}`, data: payload });
}

export async function deleteProduct(id: string): Promise<void> {
  return request<void>({ method: "DELETE", url: `${PRODUCTS_BASE}/${id}` });
}

// ---- Warehouses ----
const WAREHOUSES_BASE = "/inventory/warehouses";

export async function listWarehouses(signal?: AbortSignal): Promise<Paginated<Warehouse>> {
  return request<Paginated<Warehouse>>({ method: "GET", url: WAREHOUSES_BASE, params: { pageSize: 100 }, signal });
}

export async function createWarehouse(payload: WarehouseCreatePayload): Promise<Warehouse> {
  return request<Warehouse>({ method: "POST", url: WAREHOUSES_BASE, data: payload });
}

export async function updateWarehouse(id: string, payload: WarehouseUpdatePayload): Promise<Warehouse> {
  return request<Warehouse>({ method: "PATCH", url: `${WAREHOUSES_BASE}/${id}`, data: payload });
}

export async function deleteWarehouse(id: string): Promise<void> {
  return request<void>({ method: "DELETE", url: `${WAREHOUSES_BASE}/${id}` });
}

// ---- Stock ----
const STOCK_BASE = "/inventory/stock";

function stockQuery(p: StockListParams): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (p.page != null) q.page = p.page;
  if (p.pageSize != null) q.pageSize = p.pageSize;
  if (p.productId) q.productId = p.productId;
  if (p.warehouseId) q.warehouseId = p.warehouseId;
  if (p.lowStock != null) q.lowStock = p.lowStock;
  return q;
}

export async function listStock(
  params: StockListParams = {}, signal?: AbortSignal,
): Promise<Paginated<StockLevel>> {
  return request<Paginated<StockLevel>>({ method: "GET", url: STOCK_BASE, params: stockQuery(params), signal });
}

export async function adjustStock(payload: StockAdjustPayload): Promise<StockLevel> {
  return request<StockLevel>({ method: "POST", url: `${STOCK_BASE}/adjust`, data: payload });
}

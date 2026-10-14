/** Inventory domain types. */

export interface Product {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: number;
  currency: string;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  companyId: string;
  name: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockLevel {
  id: string;
  companyId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  minimumQuantity: number;
  product?: Product;
  warehouse?: Warehouse;
  updatedAt: string;
}

export interface ProductListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDesc?: boolean;
  search?: string;
  isActive?: boolean;
  category?: string;
}

export interface StockListParams {
  page?: number;
  pageSize?: number;
  productId?: string;
  warehouseId?: string;
  lowStock?: boolean;
}

export interface ProductCreatePayload {
  sku: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unitPrice: number;
  currency?: string;
  unit?: string;
}

export type ProductUpdatePayload = Partial<ProductCreatePayload & { isActive: boolean }>;

export interface WarehouseCreatePayload {
  name: string;
  location?: string | null;
}

export type WarehouseUpdatePayload = Partial<WarehouseCreatePayload & { isActive: boolean }>;

export interface StockAdjustPayload {
  productId: string;
  warehouseId: string;
  delta: number;
  reason?: string;
}

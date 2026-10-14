import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import type {
  ProductCreatePayload, ProductListParams, ProductUpdatePayload,
  StockAdjustPayload, StockListParams,
  WarehouseCreatePayload, WarehouseUpdatePayload,
} from "../types";
import {
  adjustStock, createProduct, createWarehouse, deleteProduct, deleteWarehouse,
  getProduct, listProducts, listStock, listWarehouses, updateProduct, updateWarehouse,
} from "../services/inventoryService";

// ---- Products ----

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.products.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listProducts(params, signal),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.products.detail(id),
    queryFn: ({ signal }) => getProduct(id, signal),
    enabled: Boolean(id),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductCreatePayload) => createProduct(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.products.lists() });
    },
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductUpdatePayload) => updateProduct(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.inventory.products.detail(id), updated);
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.products.lists() });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.inventory.products.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.products.lists() });
    },
  });
}

// ---- Warehouses ----

export function useWarehouses() {
  return useQuery({
    queryKey: queryKeys.inventory.warehouses.list(),
    queryFn: ({ signal }) => listWarehouses(signal),
  });
}

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarehouseCreatePayload) => createWarehouse(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses.all });
    },
  });
}

export function useUpdateWarehouse(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarehouseUpdatePayload) => updateWarehouse(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses.all });
    },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.warehouses.all });
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.stock.all });
    },
  });
}

// ---- Stock ----

export function useStock(params: StockListParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.stock.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listStock(params, signal),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: StockAdjustPayload) => adjustStock(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.stock.all });
    },
  });
}

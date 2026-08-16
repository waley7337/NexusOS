import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  archiveCustomer,
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../services/customersService";
import type {
  Customer,
  CustomerCreatePayload,
  CustomerListParams,
  CustomerUpdatePayload,
} from "../types";

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: queryKeys.crm.customers.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listCustomers(params, signal),
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: queryKeys.crm.customers.detail(id ?? ""),
    queryFn: ({ signal }) => getCustomer(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerCreatePayload) => createCustomer(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.customers.lists() });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CustomerUpdatePayload }) =>
      updateCustomer(id, payload),
    onSuccess: (customer: Customer) => {
      queryClient.setQueryData(queryKeys.crm.customers.detail(customer.id), customer);
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.customers.lists() });
    },
  });
}

export function useArchiveCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveCustomer(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.crm.customers.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.customers.lists() });
    },
  });
}

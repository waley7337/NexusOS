import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { listCustomers } from "../services/customersService";
import type { Customer } from "../types";

/** Max page size allowed by Customers API — one bounded fetch for pickers. */
export const CUSTOMER_OPTIONS_PAGE_SIZE = 100;

const EMPTY_CUSTOMERS: Customer[] = [];

const OPTIONS_PARAMS = {
  page: 1,
  pageSize: CUSTOMER_OPTIONS_PAGE_SIZE,
  sortBy: "company_name" as const,
  sortDesc: false,
};

/**
 * Bounded Customers list for Contact picker + name lookup.
 * One request (≤100 rows) — never one GET per Contact row.
 */
export function useCustomerOptions(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.crm.customers.options(),
    queryFn: ({ signal }) => listCustomers(OPTIONS_PARAMS, signal),
    enabled,
    staleTime: 30_000,
  });

  const customers = query.data?.items ?? EMPTY_CUSTOMERS;
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) map.set(c.id, c.companyName);
    return map;
  }, [customers]);

  const total = query.data?.meta.total ?? 0;
  const truncated = total > CUSTOMER_OPTIONS_PAGE_SIZE;

  return {
    ...query,
    customers,
    nameById,
    total,
    truncated,
  };
}

export function customerLabel(
  customerId: string,
  nameById: Map<string, string>,
  fallbackCustomer?: Customer | null,
): string {
  if (fallbackCustomer && fallbackCustomer.id === customerId) {
    return fallbackCustomer.companyName;
  }
  return nameById.get(customerId) ?? "Customer";
}

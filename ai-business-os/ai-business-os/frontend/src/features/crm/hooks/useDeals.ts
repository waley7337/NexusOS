import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  archiveDeal,
  createDeal,
  getDeal,
  listDeals,
  updateDeal,
} from "../services/dealsService";
import type {
  Deal,
  DealCreatePayload,
  DealListParams,
  DealUpdatePayload,
} from "../types";

export function useDeals(params: DealListParams) {
  return useQuery({
    queryKey: queryKeys.crm.deals.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listDeals(params, signal),
  });
}

export function useDeal(id: string | null) {
  return useQuery({
    queryKey: queryKeys.crm.deals.detail(id ?? ""),
    queryFn: ({ signal }) => getDeal(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DealCreatePayload) => createDeal(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.boundLeadIds() });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DealUpdatePayload }) =>
      updateDeal(id, payload),
    onSuccess: (deal: Deal) => {
      queryClient.setQueryData(queryKeys.crm.deals.detail(deal.id), deal);
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.lists() });
    },
  });
}

export function useArchiveDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveDeal(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.crm.deals.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.boundLeadIds() });
    },
  });
}

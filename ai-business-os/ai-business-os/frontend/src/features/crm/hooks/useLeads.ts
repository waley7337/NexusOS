import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  archiveLead,
  createLead,
  getLead,
  listLeads,
  updateLead,
} from "../services/leadsService";
import type {
  Lead,
  LeadCreatePayload,
  LeadListParams,
  LeadUpdatePayload,
} from "../types";

export function useLeads(params: LeadListParams) {
  return useQuery({
    queryKey: queryKeys.crm.leads.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listLeads(params, signal),
  });
}

export function useLead(id: string | null) {
  return useQuery({
    queryKey: queryKeys.crm.leads.detail(id ?? ""),
    queryFn: ({ signal }) => getLead(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LeadCreatePayload) => createLead(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.options() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.boundLeadIds() });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LeadUpdatePayload }) =>
      updateLead(id, payload),
    onSuccess: (lead: Lead) => {
      queryClient.setQueryData(queryKeys.crm.leads.detail(lead.id), lead);
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.options() });
    },
  });
}

export function useArchiveLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveLead(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.crm.leads.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.lists() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.options() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.deals.boundLeadIds() });
    },
  });
}

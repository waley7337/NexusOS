import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { listLeads } from "../services/leadsService";
import { listDeals } from "../services/dealsService";
import { PIPELINE_STAGE_LABELS } from "../lib/leadDisplay";
import type { Lead } from "../types";

/** Max page size allowed by Leads/Deals APIs — one bounded fetch for pickers. */
export const LEAD_OPTIONS_PAGE_SIZE = 100;

const EMPTY_LEADS: Lead[] = [];

const LEAD_OPTIONS_PARAMS = {
  page: 1,
  pageSize: LEAD_OPTIONS_PAGE_SIZE,
  sortBy: "created_at" as const,
  sortDesc: true,
};

const BOUND_DEALS_PARAMS = {
  page: 1,
  pageSize: LEAD_OPTIONS_PAGE_SIZE,
  sortBy: "created_at" as const,
  sortDesc: true,
};

/**
 * Bounded Leads list for Deal picker + table labels.
 * One request (≤100) — never one GET per Deal row.
 */
export function useLeadOptions(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.crm.leads.options(),
    queryFn: ({ signal }) => listLeads(LEAD_OPTIONS_PARAMS, signal),
    enabled,
    staleTime: 30_000,
  });

  const leads = query.data?.items ?? EMPTY_LEADS;
  const leadById = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const lead of leads) map.set(lead.id, lead);
    return map;
  }, [leads]);

  const total = query.data?.meta.total ?? 0;
  const truncated = total > LEAD_OPTIONS_PAGE_SIZE;

  return {
    ...query,
    leads,
    leadById,
    total,
    truncated,
  };
}

/**
 * Bounded set of leadIds that already have an active Deal (≤100 deals).
 * Used to prefer unbound leads in the create picker; backend remains authoritative.
 */
export function useBoundDealLeadIds(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.crm.deals.boundLeadIds(),
    queryFn: ({ signal }) => listDeals(BOUND_DEALS_PARAMS, signal),
    enabled,
    staleTime: 30_000,
  });

  const boundLeadIds = useMemo(() => {
    const set = new Set<string>();
    for (const deal of query.data?.items ?? []) set.add(deal.leadId);
    return set;
  }, [query.data?.items]);

  const truncated = (query.data?.meta.total ?? 0) > LEAD_OPTIONS_PAGE_SIZE;

  return {
    ...query,
    boundLeadIds,
    truncated,
  };
}

export function leadOptionLabel(
  lead: Lead,
  customerNameById: Map<string, string>,
): string {
  const customer = customerNameById.get(lead.customerId) ?? "Customer";
  const stage = PIPELINE_STAGE_LABELS[lead.pipelineStage];
  const note = lead.notes?.trim();
  if (note) {
    const short = note.length > 40 ? `${note.slice(0, 40)}…` : note;
    return `${customer} · ${stage} · ${short}`;
  }
  return `${customer} · ${stage}`;
}

export function leadLabel(
  leadId: string,
  leadById: Map<string, Lead>,
  customerNameById: Map<string, string>,
  fallbackLead?: Lead | null,
): string {
  const lead = (fallbackLead && fallbackLead.id === leadId ? fallbackLead : null) ??
    leadById.get(leadId);
  if (!lead) return "Lead";
  return leadOptionLabel(lead, customerNameById);
}

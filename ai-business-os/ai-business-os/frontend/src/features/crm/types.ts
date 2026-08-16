/** CRM Customers + Contacts + Leads — wire types matching backend contracts. */

export const CUSTOMER_STATUSES = ["lead", "active", "inactive", "churned"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_SORT_FIELDS = ["created_at", "company_name", "status"] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export interface Customer {
  id: string;
  companyId: string;
  companyName: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  ownerId: string | null;
  status: CustomerStatus;
  source: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

export interface CustomerListParams {
  page?: number;
  pageSize?: number;
  sortBy?: CustomerSortField;
  sortDesc?: boolean;
  search?: string;
  status?: CustomerStatus;
  ownerId?: string;
}

/** Create body — never includes server-owned fields. */
export interface CustomerCreatePayload {
  companyName: string;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  ownerId?: string | null;
  status?: CustomerStatus;
  source?: string | null;
}

/** Partial update body — only business fields. */
export type CustomerUpdatePayload = Partial<CustomerCreatePayload>;

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const CONTACT_SORT_FIELDS = ["created_at", "last_name", "first_name"] as const;
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

export interface Contact {
  id: string;
  companyId: string;
  customerId: string;
  firstName: string;
  lastName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

export interface ContactListParams {
  page?: number;
  pageSize?: number;
  sortBy?: ContactSortField;
  sortDesc?: boolean;
  search?: string;
  customerId?: string;
}

export interface ContactCreatePayload {
  customerId: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  notes?: string | null;
}

export type ContactUpdatePayload = Partial<ContactCreatePayload>;

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

/** Canonical PipelineStage order from backend enum declaration. */
export const PIPELINE_STAGES = [
  "new",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const LEAD_SORT_FIELDS = [
  "created_at",
  "pipeline_stage",
  "expected_close_date",
  "estimated_value",
] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];

export interface Lead {
  id: string;
  companyId: string;
  customerId: string;
  pipelineStage: PipelineStage;
  estimatedValue: string | number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  assignedTo: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

export interface LeadListParams {
  page?: number;
  pageSize?: number;
  sortBy?: LeadSortField;
  sortDesc?: boolean;
  search?: string;
  customerId?: string;
  pipelineStage?: PipelineStage;
  assignedTo?: string;
}

export interface LeadCreatePayload {
  customerId: string;
  pipelineStage?: PipelineStage;
  estimatedValue?: string | number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
}

export type LeadUpdatePayload = Partial<LeadCreatePayload>;

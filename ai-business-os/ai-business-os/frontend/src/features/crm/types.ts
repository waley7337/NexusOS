/** CRM Customers — wire types matching backend CustomerResponse / list params. */

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

/** CRM module — Customers / Contacts / Leads / Deals. */

export type {
  Customer,
  CustomerCreatePayload,
  CustomerListParams,
  CustomerSortField,
  CustomerStatus,
  CustomerUpdatePayload,
  Contact,
  ContactCreatePayload,
  ContactListParams,
  ContactSortField,
  ContactUpdatePayload,
  Lead,
  LeadCreatePayload,
  LeadListParams,
  LeadSortField,
  LeadUpdatePayload,
  PipelineStage,
  Deal,
  DealCreatePayload,
  DealListParams,
  DealSortField,
  DealStatus,
  DealUpdatePayload,
} from "./types";

export {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
  CONTACT_SORT_FIELDS,
  LEAD_SORT_FIELDS,
  PIPELINE_STAGES,
  DEAL_SORT_FIELDS,
  DEAL_STATUSES,
} from "./types";

export {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  archiveCustomer,
} from "./services/customersService";

export {
  listContacts,
  getContact,
  createContact,
  updateContact,
  archiveContact,
} from "./services/contactsService";

export {
  listLeads,
  getLead,
  createLead,
  updateLead,
  archiveLead,
} from "./services/leadsService";

export {
  listDeals,
  getDeal,
  createDeal,
  updateDeal,
  archiveDeal,
} from "./services/dealsService";

export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  useArchiveCustomer,
} from "./hooks/useCustomers";

export {
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useArchiveContact,
} from "./hooks/useContacts";

export {
  useLeads,
  useLead,
  useCreateLead,
  useUpdateLead,
  useArchiveLead,
} from "./hooks/useLeads";

export {
  useDeals,
  useDeal,
  useCreateDeal,
  useUpdateDeal,
  useArchiveDeal,
} from "./hooks/useDeals";

export { useCustomerOptions } from "./hooks/useCustomerOptions";
export { useLeadOptions, useBoundDealLeadIds } from "./hooks/useLeadOptions";

export {
  customerFormSchema,
  type CustomerFormValues,
} from "./schemas/customerSchema";

export {
  contactFormSchema,
  type ContactFormValues,
} from "./schemas/contactSchema";

export {
  leadFormSchema,
  type LeadFormValues,
} from "./schemas/leadSchema";

export {
  dealFormSchema,
  type DealFormValues,
} from "./schemas/dealSchema";

export { CustomersPage } from "./pages/CustomersPage";
export { ContactsPage } from "./pages/ContactsPage";
export { LeadsPage } from "./pages/LeadsPage";
export { DealsPage } from "./pages/DealsPage";

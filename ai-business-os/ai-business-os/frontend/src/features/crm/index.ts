/** CRM module — Customers (06.3) + Contacts (06.5) + Leads (06.7). */

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
} from "./types";

export {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
  CONTACT_SORT_FIELDS,
  LEAD_SORT_FIELDS,
  PIPELINE_STAGES,
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

export { useCustomerOptions } from "./hooks/useCustomerOptions";

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

export { CustomersPage } from "./pages/CustomersPage";
export { ContactsPage } from "./pages/ContactsPage";
export { LeadsPage } from "./pages/LeadsPage";

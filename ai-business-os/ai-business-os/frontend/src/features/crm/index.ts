/** CRM module — Customers (06.3) + Contacts (06.5). */

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
} from "./types";

export {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
  CONTACT_SORT_FIELDS,
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

export { useCustomerOptions } from "./hooks/useCustomerOptions";

export {
  customerFormSchema,
  type CustomerFormValues,
} from "./schemas/customerSchema";

export {
  contactFormSchema,
  type ContactFormValues,
} from "./schemas/contactSchema";

export { CustomersPage } from "./pages/CustomersPage";
export { ContactsPage } from "./pages/ContactsPage";

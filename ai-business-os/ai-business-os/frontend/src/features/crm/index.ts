/** CRM module — Customers (Part 06.3). Contacts / Leads / Deals ship later. */

export type {
  Customer,
  CustomerCreatePayload,
  CustomerListParams,
  CustomerSortField,
  CustomerStatus,
  CustomerUpdatePayload,
} from "./types";

export {
  CUSTOMER_SORT_FIELDS,
  CUSTOMER_STATUSES,
} from "./types";

export {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  archiveCustomer,
} from "./services/customersService";

export {
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  useArchiveCustomer,
} from "./hooks/useCustomers";

export {
  customerFormSchema,
  type CustomerFormValues,
} from "./schemas/customerSchema";

export { CustomersPage } from "./pages/CustomersPage";

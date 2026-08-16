import type { Customer } from "../types";
import type { CustomerFormValues } from "../schemas/customerSchema";

export function customerToFormValues(
  customer: Customer | null | undefined,
  currentUserId: string | null,
): CustomerFormValues {
  if (!customer) {
    return {
      companyName: "",
      industry: "",
      website: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      notes: "",
      status: "lead",
      source: "",
      assignMeAsOwner: false,
    };
  }
  return {
    companyName: customer.companyName,
    industry: customer.industry ?? "",
    website: customer.website ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    city: customer.city ?? "",
    country: customer.country ?? "",
    notes: customer.notes ?? "",
    status: customer.status,
    source: customer.source ?? "",
    assignMeAsOwner: Boolean(currentUserId && customer.ownerId === currentUserId),
  };
}

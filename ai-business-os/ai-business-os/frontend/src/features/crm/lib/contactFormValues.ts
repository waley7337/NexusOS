import type { Contact } from "../types";
import type { ContactFormValues } from "../schemas/contactSchema";

export function contactToFormValues(contact: Contact | null | undefined): ContactFormValues {
  if (!contact) {
    return {
      customerId: "",
      firstName: "",
      lastName: "",
      position: "",
      email: "",
      phone: "",
      linkedin: "",
      notes: "",
    };
  }
  return {
    customerId: contact.customerId,
    firstName: contact.firstName,
    lastName: contact.lastName,
    position: contact.position ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    linkedin: contact.linkedin ?? "",
    notes: contact.notes ?? "",
  };
}

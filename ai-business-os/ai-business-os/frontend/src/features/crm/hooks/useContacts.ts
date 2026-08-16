import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  archiveContact,
  createContact,
  getContact,
  listContacts,
  updateContact,
} from "../services/contactsService";
import type {
  Contact,
  ContactCreatePayload,
  ContactListParams,
  ContactUpdatePayload,
} from "../types";

export function useContacts(params: ContactListParams) {
  return useQuery({
    queryKey: queryKeys.crm.contacts.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => listContacts(params, signal),
  });
}

export function useContact(id: string | null) {
  return useQuery({
    queryKey: queryKeys.crm.contacts.detail(id ?? ""),
    queryFn: ({ signal }) => getContact(id!, signal),
    enabled: Boolean(id),
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContactCreatePayload) => createContact(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.contacts.lists() });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ContactUpdatePayload }) =>
      updateContact(id, payload),
    onSuccess: (contact: Contact) => {
      queryClient.setQueryData(queryKeys.crm.contacts.detail(contact.id), contact);
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.contacts.lists() });
    },
  });
}

export function useArchiveContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveContact(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.crm.contacts.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.crm.contacts.lists() });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  archiveCustomerNote,
  createCustomerNote,
  listCustomerNotes,
  updateCustomerNote,
} from "../services/customerNotesService";
import type {
  CustomerNote,
  CustomerNoteCreatePayload,
  CustomerNoteListParams,
  CustomerNoteUpdatePayload,
} from "../types";

export function useCustomerNotes(customerId: string | null, params: CustomerNoteListParams = {}) {
  return useQuery({
    queryKey: queryKeys.crm.customerNotes.list(customerId ?? "", params as Record<string, unknown>),
    queryFn: ({ signal }) => listCustomerNotes(customerId!, params, signal),
    enabled: Boolean(customerId),
  });
}

export function useCreateCustomerNote(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerNoteCreatePayload) =>
      createCustomerNote(customerId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.crm.customerNotes.lists(customerId),
      });
    },
  });
}

export function useUpdateCustomerNote(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, payload }: { noteId: string; payload: CustomerNoteUpdatePayload }) =>
      updateCustomerNote(customerId, noteId, payload),
    onSuccess: (note: CustomerNote) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.crm.customerNotes.lists(customerId),
      });
      queryClient.setQueryData(
        queryKeys.crm.customerNotes.detail(customerId, note.id),
        note,
      );
    },
  });
}

export function useArchiveCustomerNote(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => archiveCustomerNote(customerId, noteId),
    onSuccess: (_data, noteId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.crm.customerNotes.detail(customerId, noteId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.crm.customerNotes.lists(customerId),
      });
    },
  });
}

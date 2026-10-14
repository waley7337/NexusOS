import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import type { SendMessageRequest } from "../types";
import {
  archiveConversation, createConversation, getProviderStatus,
  listConversations, listMessages, sendMessage,
} from "../services/assistantService";

export function useProviderStatus() {
  return useQuery({
    queryKey: [...queryKeys.assistant.all, "status"],
    queryFn: getProviderStatus,
    staleTime: 30_000,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.assistant.conversations,
    queryFn: () => listConversations(),
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId
      ? queryKeys.assistant.messages(conversationId)
      : [...queryKeys.assistant.all, "messages-empty"],
    queryFn: ({ signal }) => listMessages(conversationId!, signal),
    enabled: Boolean(conversationId),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => createConversation(title),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.assistant.conversations });
    },
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveConversation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.assistant.conversations });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SendMessageRequest) => sendMessage(payload),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: queryKeys.assistant.conversations });
      void qc.invalidateQueries({
        queryKey: queryKeys.assistant.messages(result.conversationId),
      });
    },
  });
}

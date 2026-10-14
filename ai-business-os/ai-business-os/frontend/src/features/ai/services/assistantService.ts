import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Conversation, Message, ProviderStatus,
  SendMessageRequest, SendMessageResponse,
} from "../types";

const BASE = "/assistant";

export function getProviderStatus(): Promise<ProviderStatus> {
  return request<ProviderStatus>({ method: "GET", url: `${BASE}/status` });
}

export function listConversations(page = 1): Promise<Paginated<Conversation>> {
  return request<Paginated<Conversation>>({
    method: "GET",
    url: `${BASE}/conversations`,
    params: { page, pageSize: 30 },
  });
}

export function createConversation(title?: string): Promise<Conversation> {
  return request<Conversation>({
    method: "POST",
    url: `${BASE}/conversations`,
    data: { title: title ?? null },
  });
}

export function listMessages(conversationId: string, signal?: AbortSignal): Promise<Message[]> {
  return request<Message[]>({
    method: "GET",
    url: `${BASE}/conversations/${conversationId}/messages`,
    signal,
  });
}

export function archiveConversation(conversationId: string): Promise<void> {
  return request<void>({
    method: "DELETE",
    url: `${BASE}/conversations/${conversationId}`,
  });
}

export function sendMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
  return request<SendMessageResponse>({
    method: "POST",
    url: `${BASE}/chat`,
    data: payload,
  });
}

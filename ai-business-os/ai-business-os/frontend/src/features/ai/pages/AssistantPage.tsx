/**
 * AI Assistant page — conversational interface backed by OpenAI (Part 08).
 *
 * Shows an honest "not available" state when OPENAI_API_KEY is unset
 * (signalled by provider_available=false in the API response).
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, SendHorizontal, AlertCircle } from "lucide-react";
import { request } from "@/api/client";
import { queryKeys } from "@/constants/queryKeys";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface SendResponse {
  conversationId: string;
  userMessage: Message;
  assistantMessage: Message;
  providerAvailable: boolean;
}

function fetchConversations() {
  return request<{ items: Conversation[]; total: number }>({
    method: "GET",
    url: "/assistant/conversations",
  });
}

function fetchMessages(conversationId: string) {
  return request<{ data: Message[] }>({
    method: "GET",
    url: `/assistant/conversations/${conversationId}/messages`,
  });
}

function sendMessage(payload: { content: string; conversationId?: string }) {
  return request<SendResponse>({ method: "POST", url: "/assistant/chat", data: payload });
}

export function AssistantPage() {
  const qc = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [providerAvailable, setProviderAvailable] = useState<boolean | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useQuery({
    queryKey: queryKeys.assistant.conversations,
    queryFn: fetchConversations,
  });

  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    queryKey: activeConversationId
      ? queryKeys.assistant.messages(activeConversationId)
      : ["assistant", "messages", "none"],
    queryFn: () => fetchMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    if (messagesData?.data) {
      setLocalMessages(messagesData.data);
    }
  }, [messagesData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const sendMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: (result) => {
      setProviderAvailable(result.providerAvailable);
      setActiveConversationId(result.conversationId);
      setLocalMessages((prev) => {
        // Avoid duplicates if server re-fetches
        const ids = new Set(prev.map((m) => m.id));
        const next = [...prev];
        if (!ids.has(result.userMessage.id)) next.push(result.userMessage);
        if (!ids.has(result.assistantMessage.id)) next.push(result.assistantMessage);
        return next;
      });
      void qc.invalidateQueries({ queryKey: queryKeys.assistant.conversations });
    },
  });

  async function handleSend() {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;
    setInput("");
    await sendMutation.mutateAsync({
      content,
      conversationId: activeConversationId ?? undefined,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setLocalMessages([]);
    setProviderAvailable(null);
  }

  const messages = activeConversationId ? localMessages : [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-0">
      <div className="px-6 pt-6 pb-4 border-b border-line-soft flex items-center justify-between">
        <PageHeader
          title="AI Assistant"
          description="Ask questions about your business data."
        />
        <Button variant="outline" size="sm" onClick={startNewConversation}>
          New Chat
        </Button>
      </div>

      {providerAvailable === false && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-control border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            AI responses are unavailable. An administrator must configure{" "}
            <code className="font-mono">OPENAI_API_KEY</code> to enable this feature.
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-60 flex-col border-r border-line-soft p-3 gap-1 overflow-y-auto">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Recent chats</p>
          {convsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)
          ) : conversations?.items.length ? (
            conversations.items.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversationId(conv.id);
                  setLocalMessages([]);
                }}
                className={`text-left rounded px-2 py-1.5 text-sm truncate hover:bg-surface-2 transition-colors ${
                  activeConversationId === conv.id ? "bg-surface-2 font-medium" : "text-muted-foreground"
                }`}
              >
                {conv.title ?? "Untitled"}
              </button>
            ))
          ) : (
            <p className="text-small text-muted-foreground px-2">No conversations yet.</p>
          )}
        </aside>

        {/* Chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgsLoading && activeConversationId ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Sparkles className="h-10 w-10 opacity-30" />
                <p className="text-sm">Start a conversation below.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-control px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-2 text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-surface-2 rounded-control px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-line-soft p-4">
            <div className="flex gap-2 items-end">
              <textarea
                className="flex-1 rounded-control border border-line-soft bg-surface-0 px-3 py-2 text-sm resize-none min-h-[40px] max-h-32 focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Message the AI assistant…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <Button
                size="icon"
                onClick={() => void handleSend()}
                disabled={!input.trim() || sendMutation.isPending}
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Press Enter to send, Shift+Enter for new line.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

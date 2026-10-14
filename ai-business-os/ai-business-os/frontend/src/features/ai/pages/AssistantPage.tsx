/**
 * AI Assistant page — production agent with tool activity indicators,
 * confirmation flow for write operations, and honest unavailable state.
 * (Part 08.5)
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Archive, Plus, SendHorizontal, Sparkles, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { Message, PendingAction, SendMessageRequest } from "../types";
import {
  useArchiveConversation, useConversations, useMessages,
  useProviderStatus, useSendMessage,
} from "../hooks/useAssistant";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToolActivityBadge({ tools }: { tools: string[] }) {
  if (!tools.length) return null;
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
      <Wrench className="h-3 w-3" />
      <span>Used: {tools.join(", ")}</span>
    </div>
  );
}

function ConfirmActionDialog({
  pending,
  onConfirm,
  onCancel,
  loading,
}: {
  pending: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title={`Confirm: ${pending.dangerDescription}`}
      description={
        `The assistant wants to ${pending.dangerDescription}. ` +
        `Arguments: ${JSON.stringify(pending.previewArgs, null, 2)}. ` +
        `This action will be applied to your account. Confirm to proceed.`
      }
      confirmLabel="Yes, proceed"
      destructive={false}
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}

function MessageBubble({
  msg,
  toolCalls,
}: {
  msg: Message;
  toolCalls?: string[];
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-control px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground"
            : msg.isError
            ? "bg-destructive/10 text-destructive border border-destructive/20"
            : "bg-surface-2 text-foreground"
        }`}
      >
        {msg.content}
      </div>
      {!isUser && toolCalls && <ToolActivityBadge tools={toolCalls} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function AssistantPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [lastToolCalls, setLastToolCalls] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Data ---
  const { data: statusData, isLoading: statusLoading } = useProviderStatus();
  const { data: conversations, isLoading: convsLoading } = useConversations();
  const { data: messagesData, isLoading: msgsLoading } = useMessages(activeConversationId);
  const sendMutation = useSendMessage();
  const archiveMutation = useArchiveConversation();

  // Sync server messages into local state when switching conversations.
  useEffect(() => {
    if (messagesData) {
      setLocalMessages(messagesData);
      setLastToolCalls([]);
      setPendingAction(null);
    }
  }, [messagesData]);

  // Scroll to bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, sendMutation.isPending]);

  // --- Handlers ---
  async function doSend(payload: SendMessageRequest) {
    try {
      const result = await sendMutation.mutateAsync(payload);

      setActiveConversationId(result.conversationId);
      setLastToolCalls(result.toolCallsMade);
      setPendingAction(result.pendingAction ?? null);

      // Merge returned messages into local state (avoids full re-fetch latency).
      setLocalMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const next = [...prev];
        if (!ids.has(result.userMessage.id)) next.push(result.userMessage);
        if (!ids.has(result.assistantMessage.id)) next.push(result.assistantMessage);
        return next;
      });
    } catch {
      toast.error("Failed to send message. Please try again.");
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;
    setInput("");

    // Optimistic user message.
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      tokens: null,
      isError: false,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, tempMsg]);

    await doSend({
      content,
      conversationId: activeConversationId ?? undefined,
    });
  }

  async function handleConfirmAction() {
    if (!pendingAction) return;
    const content = "Confirmed.";

    const pa = pendingAction;
    setPendingAction(null);

    await doSend({
      content,
      conversationId: activeConversationId ?? undefined,
      confirmedActionId: pa.id,
      confirmedActionTool: pa.toolName,
      confirmedActionArgs: pa.previewArgs,
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
    setLastToolCalls([]);
    setPendingAction(null);
  }

  async function handleArchive(convId: string) {
    await archiveMutation.mutateAsync(convId);
    if (activeConversationId === convId) startNewConversation();
    toast.success("Conversation archived.");
  }

  // --- Provider availability ---
  const providerUnavailable =
    statusData !== undefined && !statusLoading && !statusData.available;

  const messages = activeConversationId ? localMessages : [];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-line-soft flex items-center justify-between shrink-0">
        <PageHeader
          title="AI Assistant"
          description={
            statusData?.available
              ? `Powered by ${statusData.modelName}`
              : "Ask questions about your business data."
          }
        />
        <Button variant="outline" size="sm" onClick={startNewConversation}>
          <Plus className="h-4 w-4 mr-1" /> New Chat
        </Button>
      </div>

      {/* Provider unavailable banner */}
      {providerUnavailable && (
        <div className="mx-6 mt-4 shrink-0 flex items-start gap-2 rounded-control border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            AI responses are unavailable. An administrator must configure{" "}
            <code className="font-mono">OPENAI_API_KEY</code> to enable this feature.
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — conversation list */}
        <aside className="hidden lg:flex w-64 flex-col border-r border-line-soft p-3 gap-1 overflow-y-auto shrink-0">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Recent chats</p>
          {convsLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 mb-1" />
            ))
          ) : conversations?.items.length ? (
            conversations.items.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-1 rounded px-2 py-1.5 hover:bg-surface-2 transition-colors cursor-pointer ${
                  activeConversationId === conv.id
                    ? "bg-surface-2 font-medium"
                    : ""
                }`}
                onClick={() => {
                  setActiveConversationId(conv.id);
                  setLocalMessages([]);
                  setLastToolCalls([]);
                  setPendingAction(null);
                }}
              >
                <span className="flex-1 text-sm truncate text-left">
                  {conv.title ?? "Untitled"}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5 transition-opacity"
                  title="Archive conversation"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleArchive(conv.id);
                  }}
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
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
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                <Sparkles className="h-12 w-12 opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">AI Business Assistant</p>
                  <p className="text-small mt-1">
                    Ask about customers, invoices, employees, projects, or get a business summary.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[
                      "Show outstanding invoices",
                      "List active projects",
                      "Find customers named Acme",
                      "Summarize business metrics",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        className="text-xs px-3 py-1.5 border border-line-soft rounded-control hover:bg-surface-2 transition-colors text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setInput(prompt);
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isLast = idx === messages.length - 1;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    toolCalls={isLast && msg.role === "assistant" ? lastToolCalls : undefined}
                  />
                );
              })
            )}

            {/* Typing indicator */}
            {sendMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-surface-2 rounded-control px-3 py-2 text-sm text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-line-soft p-4 shrink-0">
            {/* Pending action notice */}
            {pendingAction && (
              <div className="mb-3 flex items-start gap-2 rounded-control border border-warning/30 bg-warning/5 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Confirm action required</p>
                  <p className="text-small text-muted-foreground">
                    The assistant wants to: <strong>{pendingAction.dangerDescription}</strong>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingAction(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleConfirmAction()}
                    disabled={sendMutation.isPending}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <textarea
                className="flex-1 rounded-control border border-line-soft bg-surface-0 px-3 py-2 text-sm resize-none min-h-[40px] max-h-32 focus:outline-hidden focus:ring-1 focus:ring-ring"
                placeholder={
                  providerUnavailable
                    ? "AI unavailable — OPENAI_API_KEY not configured"
                    : "Message the AI assistant…"
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={sendMutation.isPending}
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
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Full confirmation dialog for destructive write actions */}
      {pendingAction && (
        <ConfirmActionDialog
          pending={pendingAction}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setPendingAction(null)}
          loading={sendMutation.isPending}
        />
      )}
    </div>
  );
}

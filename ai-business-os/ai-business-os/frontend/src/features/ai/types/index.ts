/** Types for the AI Assistant feature. */

export interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens: number | null;
  isError: boolean;
  createdAt: string;
}

export interface PendingAction {
  id: string;
  toolName: string;
  dangerDescription: string;
  previewArgs: Record<string, unknown>;
}

export interface SendMessageRequest {
  content: string;
  conversationId?: string;
  confirmedActionId?: string;
  confirmedActionTool?: string;
  confirmedActionArgs?: Record<string, unknown>;
}

export interface SendMessageResponse {
  conversationId: string;
  userMessage: Message;
  assistantMessage: Message;
  providerAvailable: boolean;
  toolCallsMade: string[];
  pendingAction: PendingAction | null;
}

export interface ProviderStatus {
  available: boolean;
  modelName: string;
  maxToolIterations: number;
}

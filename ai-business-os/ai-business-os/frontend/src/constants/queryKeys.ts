/** Hierarchical TanStack Query keys — mirror REST paths. */
export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: ["dashboard"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },
  crm: {
    all: ["crm"] as const,
    customers: {
      all: ["crm", "customers"] as const,
      lists: () => ["crm", "customers", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["crm", "customers", "list", params] as const,
      details: () => ["crm", "customers", "detail"] as const,
      detail: (id: string) => ["crm", "customers", "detail", id] as const,
    },
  },
} as const;

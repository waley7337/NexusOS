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
} as const;

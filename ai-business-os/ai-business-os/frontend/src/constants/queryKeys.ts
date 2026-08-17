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
      /** Bounded options list for pickers / contact name lookup (pageSize ≤ 100). */
      options: () => ["crm", "customers", "options"] as const,
    },
    customerNotes: {
      all: ["crm", "customer-notes"] as const,
      lists: (customerId: string) => ["crm", "customer-notes", customerId, "list"] as const,
      list: (customerId: string, params: Record<string, unknown>) =>
        ["crm", "customer-notes", customerId, "list", params] as const,
      details: (customerId: string) =>
        ["crm", "customer-notes", customerId, "detail"] as const,
      detail: (customerId: string, noteId: string) =>
        ["crm", "customer-notes", customerId, "detail", noteId] as const,
    },
    contacts: {
      all: ["crm", "contacts"] as const,
      lists: () => ["crm", "contacts", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["crm", "contacts", "list", params] as const,
      details: () => ["crm", "contacts", "detail"] as const,
      detail: (id: string) => ["crm", "contacts", "detail", id] as const,
    },
    leads: {
      all: ["crm", "leads"] as const,
      lists: () => ["crm", "leads", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["crm", "leads", "list", params] as const,
      details: () => ["crm", "leads", "detail"] as const,
      detail: (id: string) => ["crm", "leads", "detail", id] as const,
      /** Bounded options for Deal lead picker / labels (pageSize ≤ 100). */
      options: () => ["crm", "leads", "options"] as const,
    },
    deals: {
      all: ["crm", "deals"] as const,
      lists: () => ["crm", "deals", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["crm", "deals", "list", params] as const,
      details: () => ["crm", "deals", "detail"] as const,
      detail: (id: string) => ["crm", "deals", "detail", id] as const,
      /** Bounded active Deal→Lead ids for create-picker filtering. */
      boundLeadIds: () => ["crm", "deals", "bound-lead-ids"] as const,
    },
  },
  hr: {
    all: ["hr"] as const,
    employees: {
      all: ["hr", "employees"] as const,
      lists: () => ["hr", "employees", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["hr", "employees", "list", params] as const,
      details: () => ["hr", "employees", "detail"] as const,
      detail: (id: string) => ["hr", "employees", "detail", id] as const,
      options: () => ["hr", "employees", "options"] as const,
    },
  },
} as const;

/** Hierarchical TanStack Query keys — mirror REST paths. */
export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: ["dashboard"] as const,
    metrics: ["dashboard", "metrics"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    // Distinct from unreadCount so setQueriesData(list) cannot rewrite { count }.
    list: ["notifications", "list"] as const,
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
    leaveRequests: {
      all: ["hr", "leave-requests"] as const,
      lists: () => ["hr", "leave-requests", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["hr", "leave-requests", "list", params] as const,
      detail: (id: string) => ["hr", "leave-requests", "detail", id] as const,
    },
    attendance: {
      all: ["hr", "attendance"] as const,
      lists: () => ["hr", "attendance", "list"] as const,
      list: (params: Record<string, unknown>) =>
        ["hr", "attendance", "list", params] as const,
      detail: (id: string) => ["hr", "attendance", "detail", id] as const,
    },
  },
  finance: {
    invoices: {
      all: ["finance", "invoices"] as const,
      lists: () => ["finance", "invoices", "list"] as const,
      list: (params: Record<string, unknown>) => ["finance", "invoices", "list", params] as const,
      detail: (id: string) => ["finance", "invoices", "detail", id] as const,
    },
    payments: {
      all: ["finance", "payments"] as const,
      list: (invoiceId: string) => ["finance", "payments", "list", invoiceId] as const,
      detail: (id: string) => ["finance", "payments", "detail", id] as const,
    },
    expenses: {
      all: ["finance", "expenses"] as const,
      lists: () => ["finance", "expenses", "list"] as const,
      list: (params: Record<string, unknown>) => ["finance", "expenses", "list", params] as const,
      detail: (id: string) => ["finance", "expenses", "detail", id] as const,
    },
    paymentProviders: {
      stripe: ["finance", "payment-providers", "stripe"] as const,
    },
  },
  billing: {
    all: ["billing"] as const,
    subscription: ["billing", "subscription"] as const,
    plans: ["billing", "plans"] as const,
    checkoutSession: (sessionId: string) =>
      ["billing", "checkout-session", sessionId] as const,
  },
  projects: {
    all: ["projects"] as const,
    lists: () => ["projects", "list"] as const,
    list: (params: Record<string, unknown>) => ["projects", "list", params] as const,
    details: () => ["projects", "detail"] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    lists: () => ["tasks", "list"] as const,
    list: (params: Record<string, unknown>) => ["tasks", "list", params] as const,
    details: () => ["tasks", "detail"] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  inventory: {
    all: ["inventory"] as const,
    products: {
      all: ["inventory", "products"] as const,
      lists: () => ["inventory", "products", "list"] as const,
      list: (params: Record<string, unknown>) => ["inventory", "products", "list", params] as const,
      detail: (id: string) => ["inventory", "products", "detail", id] as const,
    },
    warehouses: {
      all: ["inventory", "warehouses"] as const,
      list: () => ["inventory", "warehouses", "list"] as const,
    },
    stock: {
      all: ["inventory", "stock"] as const,
      list: (params: Record<string, unknown>) => ["inventory", "stock", "list", params] as const,
    },
  },
  reports: {
    all: ["reports"] as const,
    summary: (params: Record<string, unknown>) => ["reports", "summary", params] as const,
  },
  settings: {
    all: ["settings"] as const,
    company: ["settings", "company"] as const,
  },
  assistant: {
    all: ["assistant"] as const,
    conversations: ["assistant", "conversations"] as const,
    messages: (conversationId: string) => ["assistant", "messages", conversationId] as const,
  },
} as const;

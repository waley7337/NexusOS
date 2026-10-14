export const INVOICE_STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_SORT_FIELDS = ["created_at", "issue_date", "due_date", "invoice_number", "total", "status"] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export interface InvoiceItemInput { description: string; quantity: string; unitPrice: string }
export interface InvoiceItem extends InvoiceItemInput { id: string; total: string }
export interface Invoice {
  id: string; companyId: string; customerId: string; customerName: string;
  invoiceNumber: string; issueDate: string; dueDate: string; status: InvoiceStatus;
  subtotal: string; tax: string; total: string; currency: string;
  sentAt: string | null; voidedAt: string | null; items: InvoiceItem[];
  amountPaid: string; outstandingBalance: string; isActive: boolean;
  createdAt: string; updatedAt: string; createdBy: string | null;
  updatedBy: string | null; deletedAt: string | null;
}
export interface InvoiceListParams {
  page?: number; pageSize?: number; sortBy?: InvoiceSortField; sortDesc?: boolean;
  search?: string; status?: InvoiceStatus; customerId?: string;
}
export interface InvoicePayload {
  invoiceNumber: string; customerId: string; issueDate: string; dueDate: string;
  currency: string; tax: string; items: InvoiceItemInput[];
}
export type InvoiceUpdatePayload = Partial<InvoicePayload>;

export const PAYMENT_METHODS = [
  "bank_transfer",
  "card",
  "cash",
  "stripe",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "completed",
  "failed",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_SOURCES = ["manual", "provider"] as const;
export type PaymentSource = (typeof PAYMENT_SOURCES)[number];

/** Invoice statuses that accept new manual payments (mirrors backend authority). */
export const PAYMENT_ELIGIBLE_INVOICE_STATUSES: ReadonlySet<InvoiceStatus> = new Set([
  "sent",
  "partially_paid",
  "overdue",
]);

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  source: PaymentSource;
  refundedAmount: string;
  confirmedAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPaymentPayload {
  amount: string;
  currency: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes?: string | null;
}

export interface ManualRefundPayload {
  amount: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const EXPENSE_SORT_FIELDS = ["created_at", "date", "amount", "category"] as const;
export type ExpenseSortField = (typeof EXPENSE_SORT_FIELDS)[number];

export interface Expense {
  id: string;
  companyId: string;
  category: string;
  amount: string;
  currency: string;
  description: string | null;
  date: string;
  paidBy: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

export interface ExpenseListParams {
  page?: number;
  pageSize?: number;
  sortBy?: ExpenseSortField;
  sortDesc?: boolean;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExpensePayload {
  category: string;
  amount: string;
  currency: string;
  description?: string | null;
  date: string;
  paidBy?: string | null;
}

export type ExpenseUpdatePayload = Partial<ExpensePayload>;

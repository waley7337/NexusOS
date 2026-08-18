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

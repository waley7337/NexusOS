import { Link } from "react-router-dom";
import type { Invoice } from "../types";

function money(value: string, currency: string) {
  return `${currency} ${value}`;
}
export function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  return <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2"><table className="w-full text-sm"><thead><tr className="border-b border-line-soft bg-surface-3/80 text-left text-2xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Issued</th><th className="px-4 py-3">Due</th><th className="px-4 py-3 text-right">Total</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-line-soft last:border-0 hover:bg-surface-3"><td className="px-4 py-3 font-medium"><Link className="focus-ring rounded-sm text-primary hover:underline" to={`/finance/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></td><td className="px-4 py-3">{invoice.customerName}</td><td className="px-4 py-3 capitalize">{invoice.status.replace("_", " ")}</td><td className="px-4 py-3 tabular-nums">{invoice.issueDate}</td><td className="px-4 py-3 tabular-nums">{invoice.dueDate}</td><td className="px-4 py-3 text-right font-mono tabular-nums">{money(invoice.total, invoice.currency)}</td></tr>)}</tbody></table></div>;
}

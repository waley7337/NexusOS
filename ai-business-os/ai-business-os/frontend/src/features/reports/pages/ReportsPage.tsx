/**
 * Reports page — aggregated metrics across Finance, CRM, and Inventory.
 * Calls GET /reports/summary with optional date range.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { request } from "@/api/client";
import { queryKeys } from "@/constants/queryKeys";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportSummary {
  period: { fromDate: string; toDate: string };
  finance: {
    invoicesByStatus: Record<string, { count: number; totalAmount: string }>;
    paymentsCollected: { count: number; netPaid: string };
  };
  crm: { customerCount: number; openLeadCount: number; openDealCount: number };
  inventory: { lowStockCount: number };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function thirtyDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [fromDate, setFromDate] = useState(thirtyDaysAgoStr());
  const [toDate, setToDate] = useState(todayStr());
  const [applied, setApplied] = useState({ fromDate, toDate });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.reports.summary(applied),
    queryFn: () =>
      request<ReportSummary>({
        method: "GET",
        url: "/reports/summary",
        params: { fromDate: applied.fromDate, toDate: applied.toDate },
      }),
  });

  function handleApply() {
    setApplied({ fromDate, toDate });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Reports"
        description="Aggregated metrics for the selected period."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      {/* Date range picker */}
      <div className="flex flex-wrap items-end gap-3 surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Button onClick={handleApply}>Apply</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-control" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Failed to load report" description={String(error)} />
      ) : data ? (
        <div className="flex flex-col gap-6">
          {/* Finance section */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Finance</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Payments Collected"
                value={`${data.finance.paymentsCollected.count} payments`}
                sub={`Net paid: ${Number(data.finance.paymentsCollected.netPaid).toFixed(2)}`}
              />
              {Object.entries(data.finance.invoicesByStatus).map(([status, info]) => (
                <MetricCard
                  key={status}
                  label={`Invoices — ${status.replace(/_/g, " ")}`}
                  value={`${info.count} invoices`}
                  sub={`Total: ${Number(info.totalAmount).toFixed(2)}`}
                />
              ))}
            </div>
          </section>

          {/* CRM section */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">CRM</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Customers" value={String(data.crm.customerCount)} />
              <MetricCard label="Open Leads" value={String(data.crm.openLeadCount)} />
              <MetricCard label="Open Deals" value={String(data.crm.openDealCount)} />
            </div>
          </section>

          {/* Inventory section */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Inventory</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Low Stock Items"
                value={String(data.inventory.lowStockCount)}
                highlight={data.inventory.lowStockCount > 0}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label, value, sub, highlight,
}: {
  label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className="surface p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className="text-small text-muted-foreground">{sub}</p>}
    </div>
  );
}

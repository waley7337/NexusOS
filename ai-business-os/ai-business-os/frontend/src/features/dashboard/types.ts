/**
 * Dashboard operational snapshot.
 *
 * Describes liveness/readiness signals from GET /health and GET /ready.
 */
export interface DashboardSnapshot {
  apiStatus: string;
  environment: string;
  database: "ok" | "unavailable";
}

// ---------------------------------------------------------------------------
// Dashboard metrics — tenant-scoped operational KPIs
// Returned by GET /api/v1/dashboard/metrics
// ---------------------------------------------------------------------------

export interface DashboardFinanceMetrics {
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  outstandingAmount: string; // decimal string to preserve precision
  collectedThisMonth: string;
  collectedPaymentCount: number;
}

export interface DashboardCrmMetrics {
  customerCount: number;
  openLeadCount: number;
  openDealCount: number;
}

export interface DashboardProjectMetrics {
  activeProjectCount: number;
  totalProjectCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
}

export interface DashboardHrMetrics {
  employeeCount: number;
}

export interface DashboardInventoryMetrics {
  lowStockCount: number;
}

export interface DashboardMetrics {
  asOf: string; // ISO date string
  monthStart: string; // ISO date string
  finance: DashboardFinanceMetrics;
  crm: DashboardCrmMetrics;
  projects: DashboardProjectMetrics;
  hr: DashboardHrMetrics;
  inventory: DashboardInventoryMetrics;
}

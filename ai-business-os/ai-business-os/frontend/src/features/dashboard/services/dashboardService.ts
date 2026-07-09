import type { DashboardData } from "../types";

const MOCK: DashboardData = {
  kpis: [
    { id: "revenue", label: "Revenue", value: "$128,430", delta: 18 },
    { id: "projects", label: "Active projects", value: "14", delta: 2 },
    { id: "customers", label: "Customers", value: "312", delta: 6 },
    { id: "tasks", label: "Tasks due today", value: "23", delta: -12 },
    { id: "invoices", label: "Outstanding invoices", value: "$9,120", delta: -8 },
    { id: "inventory", label: "Inventory alerts", value: "3", delta: 0 },
  ],
  revenue: [
    { month: "Jan", revenue: 74, expenses: 52 },
    { month: "Feb", revenue: 81, expenses: 55 },
    { month: "Mar", revenue: 78, expenses: 51 },
    { month: "Apr", revenue: 92, expenses: 58 },
    { month: "May", revenue: 99, expenses: 61 },
    { month: "Jun", revenue: 112, expenses: 63 },
    { month: "Jul", revenue: 128, expenses: 66 },
  ],
  pipeline: [
    { stage: "Lead", count: 42, value: 210 },
    { stage: "Qualified", count: 24, value: 168 },
    { stage: "Proposal", count: 11, value: 122 },
    { stage: "Negotiation", count: 6, value: 88 },
    { stage: "Won", count: 4, value: 64 },
  ],
  activity: [
    { id: "1", actor: "Sarah Kim", action: "closed deal with", target: "Acme Ltd.", time: "12 min ago" },
    { id: "2", actor: "Omar Farouk", action: "completed task", target: "Q3 forecast review", time: "34 min ago" },
    { id: "3", actor: "Lena Weber", action: "sent invoice to", target: "Northwind GmbH", time: "1 h ago" },
    { id: "4", actor: "You", action: "created project", target: "Website Relaunch", time: "2 h ago" },
    { id: "5", actor: "Marco Rossi", action: "added contact at", target: "Globex Corp.", time: "3 h ago" },
  ],
  insights: [
    { id: "1", severity: "warning", text: "3 invoices are overdue — $9,120 outstanding." },
    { id: "2", severity: "warning", text: "Project Alpha is 4 days behind schedule." },
    { id: "3", severity: "info", text: "John's workload is at 92% this week." },
    { id: "4", severity: "success", text: "Sales increased 12% compared to last month." },
    { id: "5", severity: "warning", text: "Inventory for Product X is below reorder point." },
  ],
  meetings: [
    { id: "1", title: "Weekly pipeline review", time: "Today · 14:00", attendees: 5 },
    { id: "2", title: "Acme Ltd. onboarding call", time: "Today · 16:30", attendees: 3 },
    { id: "3", title: "Sprint planning", time: "Tomorrow · 09:30", attendees: 8 },
  ],
};

/** Dashboard aggregate — Part 6+ replaces body with request<DashboardData>(). */
export async function getDashboard(): Promise<DashboardData> {
  await new Promise((r) => setTimeout(r, 700));
  return MOCK;
}

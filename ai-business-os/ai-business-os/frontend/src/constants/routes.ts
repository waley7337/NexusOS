import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, UserRound, Wallet,
  Boxes, FileText, BarChart3, Sparkles, Settings, Palette,
} from "lucide-react";

export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  design: "/design",
  crm: "/crm",
  crmCustomers: "/crm/customers",
  crmContacts: "/crm/contacts",
  crmLeads: "/crm/leads",
  crmDeals: "/crm/deals",
  projects: "/projects",
  tasks: "/tasks",
  hr: "/hr",
  finance: "/finance",
  inventory: "/inventory",
  documents: "/documents",
  reports: "/reports",
  assistant: "/assistant",
  settings: "/settings",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export interface NavItem {
  to: RoutePath;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Sidebar grouping (Part 04, Phase 5). Absent/"primary" renders inline;
   * "more" collapses under the "More modules" disclosure. Does not affect
   * PALETTE_PAGES, which stays a flat list for ⌘K search. */
  group?: "primary" | "more";
}

/** Sidebar navigation items. */
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.home, label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: ROUTES.crm, label: "CRM", icon: Users },
  { to: ROUTES.projects, label: "Projects", icon: FolderKanban },
  { to: ROUTES.tasks, label: "Tasks", icon: CheckSquare },
  { to: ROUTES.finance, label: "Finance", icon: Wallet },
  { to: ROUTES.hr, label: "HR", icon: UserRound, group: "more" },
  { to: ROUTES.inventory, label: "Inventory", icon: Boxes, group: "more" },
  { to: ROUTES.documents, label: "Documents", icon: FileText, group: "more" },
  { to: ROUTES.reports, label: "Reports", icon: BarChart3, group: "more" },
  { to: ROUTES.assistant, label: "AI Assistant", icon: Sparkles, group: "more" },
  { to: ROUTES.settings, label: "Settings", icon: Settings, group: "more" },
];

/** Command palette pages — sidebar items plus design system. */
export const PALETTE_PAGES: NavItem[] = [
  ...NAV_ITEMS,
  { to: ROUTES.design, label: "Design system", icon: Palette },
];

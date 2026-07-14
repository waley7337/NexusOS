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
}

/** Sidebar navigation items. */
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.home, label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: ROUTES.crm, label: "CRM", icon: Users },
  { to: ROUTES.projects, label: "Projects", icon: FolderKanban },
  { to: ROUTES.tasks, label: "Tasks", icon: CheckSquare },
  { to: ROUTES.hr, label: "HR", icon: UserRound },
  { to: ROUTES.finance, label: "Finance", icon: Wallet },
  { to: ROUTES.inventory, label: "Inventory", icon: Boxes },
  { to: ROUTES.documents, label: "Documents", icon: FileText },
  { to: ROUTES.reports, label: "Reports", icon: BarChart3 },
  { to: ROUTES.assistant, label: "AI Assistant", icon: Sparkles },
  { to: ROUTES.settings, label: "Settings", icon: Settings },
];

/** Command palette pages — sidebar items plus design system. */
export const PALETTE_PAGES: NavItem[] = [
  ...NAV_ITEMS,
  { to: ROUTES.design, label: "Design system", icon: Palette },
];

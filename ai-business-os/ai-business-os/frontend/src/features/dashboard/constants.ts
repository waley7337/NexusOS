import { ROUTES } from "@/constants/routes";

/**
 * Short, truthful summaries for placeholder modules.
 * These describe what each route is for — not current business values.
 */
export const MODULE_SUMMARIES: Record<string, string> = {
  [ROUTES.crm]: "Companies, contacts, leads, and deals.",
  [ROUTES.projects]: "Boards, lists, timelines, and calendars.",
  [ROUTES.tasks]: "Work assigned to you and your team.",
  [ROUTES.finance]: "Revenue, expenses, invoices, and payments.",
  [ROUTES.hr]: "People, attendance, leave, and performance.",
  [ROUTES.inventory]: "Products, warehouses, and stock movements.",
  [ROUTES.documents]: "Store, organize, and share files.",
  [ROUTES.reports]: "Exports and scheduled reports.",
  [ROUTES.assistant]: "Questions about the business, in plain language.",
  [ROUTES.settings]: "Workspace, members, roles, and preferences.",
};

import { Users, FolderKanban, CheckSquare, UserRound, Wallet, Boxes, FileText, BarChart3, Sparkles, Settings } from "lucide-react";
import { ModulePlaceholder } from "./ModulePlaceholder";

export function CrmPlaceholder() {
  return (
    <ModulePlaceholder
      title="CRM"
      icon={Users}
      description="Track companies, contacts, leads, and deals in one connected pipeline."
      action="Create customer"
    />
  );
}

export function ProjectsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Projects"
      icon={FolderKanban}
      description="Plan work with boards, lists, timelines, and calendars."
      action="Create project"
    />
  );
}

export function TasksPlaceholder() {
  return (
    <ModulePlaceholder
      title="Tasks"
      icon={CheckSquare}
      description="Everything assigned to you and your team, in one place."
      action="Create task"
    />
  );
}

export function HrPlaceholder() {
  return (
    <ModulePlaceholder
      title="HR"
      icon={UserRound}
      description="Employee profiles, attendance, leave, and performance."
      action="Add employee"
    />
  );
}

export function FinancePlaceholder() {
  return (
    <ModulePlaceholder
      title="Finance"
      icon={Wallet}
      description="Revenue, expenses, invoices, and payments — all visual."
      action="Create invoice"
    />
  );
}

export function InventoryPlaceholder() {
  return (
    <ModulePlaceholder
      title="Inventory"
      icon={Boxes}
      description="Products, warehouses, purchase orders, and stock movements."
      action="Add product"
    />
  );
}

export function DocumentsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Documents"
      icon={FileText}
      description="Store, organize, and share every business document."
      action="Upload document"
    />
  );
}

export function ReportsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Reports"
      icon={BarChart3}
      description="Export, schedule, and share reports across every module."
      action="Create report"
    />
  );
}

export function AssistantPlaceholder() {
  return (
    <ModulePlaceholder
      title="AI Assistant"
      icon={Sparkles}
      description="Ask questions about your business in plain language."
      action="Start a conversation"
    />
  );
}

export function SettingsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Settings"
      icon={Settings}
      description="Company profile, members, roles, and preferences."
      action="Open settings"
    />
  );
}

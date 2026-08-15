import { Users, FolderKanban, CheckSquare, UserRound, Wallet, Boxes, FileText, BarChart3, Sparkles, Settings } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { MODULE_SUMMARIES } from "@/features/dashboard/constants";
import { ModulePlaceholder } from "./ModulePlaceholder";

export function CrmPlaceholder() {
  return (
    <ModulePlaceholder
      title="CRM"
      icon={Users}
      description={MODULE_SUMMARIES[ROUTES.crm]}
    />
  );
}

export function ProjectsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Projects"
      icon={FolderKanban}
      description={MODULE_SUMMARIES[ROUTES.projects]}
    />
  );
}

export function TasksPlaceholder() {
  return (
    <ModulePlaceholder
      title="Tasks"
      icon={CheckSquare}
      description={MODULE_SUMMARIES[ROUTES.tasks]}
    />
  );
}

export function HrPlaceholder() {
  return (
    <ModulePlaceholder
      title="HR"
      icon={UserRound}
      description={MODULE_SUMMARIES[ROUTES.hr]}
    />
  );
}

export function FinancePlaceholder() {
  return (
    <ModulePlaceholder
      title="Finance"
      icon={Wallet}
      description={MODULE_SUMMARIES[ROUTES.finance]}
    />
  );
}

export function InventoryPlaceholder() {
  return (
    <ModulePlaceholder
      title="Inventory"
      icon={Boxes}
      description={MODULE_SUMMARIES[ROUTES.inventory]}
    />
  );
}

export function DocumentsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Documents"
      icon={FileText}
      description={MODULE_SUMMARIES[ROUTES.documents]}
    />
  );
}

export function ReportsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Reports"
      icon={BarChart3}
      description={MODULE_SUMMARIES[ROUTES.reports]}
    />
  );
}

export function AssistantPlaceholder() {
  return (
    <ModulePlaceholder
      title="AI Assistant"
      icon={Sparkles}
      description={MODULE_SUMMARIES[ROUTES.assistant]}
    />
  );
}

export function SettingsPlaceholder() {
  return (
    <ModulePlaceholder
      title="Settings"
      icon={Settings}
      description={MODULE_SUMMARIES[ROUTES.settings]}
    />
  );
}

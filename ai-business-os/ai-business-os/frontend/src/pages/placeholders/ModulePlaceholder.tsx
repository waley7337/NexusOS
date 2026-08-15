import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

interface ModulePlaceholderProps {
  title: string;
  icon: LucideIcon;
  description: string;
}

/** Honest empty module. No create/upload/open actions — those APIs do not exist. */
export function ModulePlaceholder({ title, icon, description }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={icon}
        title="Not operational yet"
        description="This module has no API yet. NexusOS does not invent records, metrics, or actions here."
      />
    </div>
  );
}

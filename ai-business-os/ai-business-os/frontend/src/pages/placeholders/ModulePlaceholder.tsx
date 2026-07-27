import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

interface ModulePlaceholderProps {
  title: string;
  icon: LucideIcon;
  description: string;
  action: string;
}

export function ModulePlaceholder({ title, icon, description, action }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <EmptyState
        icon={icon}
        title={`No ${title.toLowerCase()} yet`}
        description={description}
        actionLabel={action}
        onAction={() => toast.info(`${title} ships in an upcoming part.`)}
      />
    </div>
  );
}

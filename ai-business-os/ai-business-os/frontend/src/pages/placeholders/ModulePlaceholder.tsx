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
        // h2, not the h3 default. Here the empty state IS the page's only
        // section and sits directly under the PageHeader h1, so the default
        // produced an outline of 1,3. On the dashboard it stays h3 because a
        // SectionHeader h2 genuinely wraps it there.
        as="h2"
        // The precise machine fact, and deliberately not a restatement of
        // the title: the heading is the human sentence, the register is
        // what the system knows. "No endpoint" is the actual reason this
        // module is empty.
        status="No endpoint"
        title="Not operational yet"
        description="This module has no API yet. NexusOS does not invent records, metrics, or actions here."
      />
    </div>
  );
}

import type { ReactNode } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import { cn } from "@/lib/utils";

/** One portfolio section: NexusOS SectionHeader + the product's scroll reveal. */
export function Section({
  id,
  title,
  subtitle,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRevealOnScroll<HTMLElement>();
  return (
    <section ref={ref} id={id} aria-label={title} className={cn("reveal-section scroll-mt-6 space-y-6", className)}>
      <SectionHeader title={title} subtitle={subtitle} action={action} tone="primary" />
      {children}
    </section>
  );
}

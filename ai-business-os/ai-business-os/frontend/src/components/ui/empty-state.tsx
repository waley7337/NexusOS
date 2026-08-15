/**
 * EmptyState — honest empty surface. Describes what the space is for.
 * An action is optional and only rendered when the caller has a real one.
 */
import { type ComponentType, type ReactNode } from "react";
import { Button } from "./button";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
  /** Default h3 for nested empties (page already has an h1). Error pages pass h1. */
  as?: "h1" | "h2" | "h3";
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, children, as: Heading = "h3" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-soft px-6 py-12 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-4">
        <Icon className="h-[var(--icon-md)] w-[var(--icon-md)] text-muted-foreground" aria-hidden="true" />
      </div>
      <Heading className="text-sm font-semibold">{title}</Heading>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>
      )}
      {children}
    </div>
  );
}

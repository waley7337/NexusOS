/**
 * ErrorState — never "Error 500". Say what failed in plain words and offer Retry.
 */
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something didn't load",
  description = "We couldn't load this section. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-line-soft px-6 py-12 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-[var(--icon-md)] w-[var(--icon-md)] text-destructive" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-muted-foreground text-sm">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>Retry</Button>
      )}
    </div>
  );
}

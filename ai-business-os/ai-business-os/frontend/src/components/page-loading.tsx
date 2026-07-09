import { Skeleton } from "@/components/ui/skeleton";

/** Lightweight fallback while a lazy route chunk loads. */
export function PageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

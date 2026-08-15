import { Skeleton } from "@/components/ui/skeleton";

/** Lightweight fallback while a lazy route chunk loads. Geometry matches
 *  the PageHeader + body rhythm of module pages so the shell does not
 *  collapse to a spinner, then jump when the real heading arrives. */
export function PageLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-9 w-52" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

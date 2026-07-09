import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { PageLoading } from "@/components/page-loading";

/** Wraps nested routes with error isolation + lazy-load suspense. */
export function LazyOutlet() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoading />}>
        <Outlet />
      </Suspense>
    </RouteErrorBoundary>
  );
}

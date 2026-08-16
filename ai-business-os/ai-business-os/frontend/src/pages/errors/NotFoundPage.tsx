import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        as="h1"
        description="That URL doesn't match anything in NexusOS. Check the address or head back to the dashboard."
      >
        <div className="mt-5">
          <Link to={ROUTES.home} className={cn(buttonVariants())}>
            Go to dashboard
          </Link>
        </div>
      </EmptyState>
    </div>
  );
}

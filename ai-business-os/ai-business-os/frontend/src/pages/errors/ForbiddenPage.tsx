import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <EmptyState
        icon={ShieldX}
        title="Access denied"
        as="h1"
        description="You don't have permission to view this page. Contact your administrator if you need access."
      >
        <div className="mt-5">
          <Link to={ROUTES.home} className={cn(buttonVariants({ variant: "outline" }))}>
            Back to dashboard
          </Link>
        </div>
      </EmptyState>
    </div>
  );
}

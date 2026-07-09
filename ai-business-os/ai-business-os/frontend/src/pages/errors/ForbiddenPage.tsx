import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";

export function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <ShieldX className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Contact your administrator if you need access.
        </p>
      </div>
      <Link to={ROUTES.home}>
        <Button variant="outline">Back to dashboard</Button>
      </Link>
    </div>
  );
}

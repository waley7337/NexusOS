import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          That URL doesn&apos;t match anything in NexusOS. Check the address or head back to the dashboard.
        </p>
      </div>
      <Link to={ROUTES.home}>
        <Button>Go to dashboard</Button>
      </Link>
    </div>
  );
}

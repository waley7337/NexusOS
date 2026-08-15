import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/** Global offline notice — shown when the browser loses connectivity (§5.9). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b border-warning/40 bg-warning/10 px-4 py-2 text-sm text-foreground"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      You&apos;re offline — changes can&apos;t be saved.
    </div>
  );
}

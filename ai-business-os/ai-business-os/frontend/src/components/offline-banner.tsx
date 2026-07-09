import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/** Global offline notice — shown when the browser loses connectivity (§5.9). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      You&apos;re offline — changes can&apos;t be saved.
    </div>
  );
}

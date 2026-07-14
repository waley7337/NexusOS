import { QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { queryClient } from "@/lib/query-client";

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    return onlineManager.setEventListener((setOnline) => {
      const onOnline = () => setOnline(true);
      const onOffline = () => setOnline(false);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    });
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

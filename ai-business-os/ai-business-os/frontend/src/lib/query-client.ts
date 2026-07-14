/**
 * Shared TanStack Query client — module-level singleton so it can be reached
 * from outside the React tree (the axios response interceptor clears it on
 * session expiry: tenant data must not survive logout, see §5.11).
 * `QueryProvider` renders this instance rather than constructing its own.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

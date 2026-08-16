import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/constants/queryKeys";
import { useSystemStatus } from "../useSystemStatus";
import type { DashboardSnapshot } from "@/features/dashboard/types";

function wrapperFor(snapshot: DashboardSnapshot) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.dashboard.summary, snapshot);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useSystemStatus", () => {
  it("reports Connected when both probes succeeded", () => {
    const { result } = renderHook(() => useSystemStatus(), {
      wrapper: wrapperFor({ apiStatus: "ok", environment: "test", database: "ok" }),
    });
    expect(result.current).toMatchObject({ variant: "online", label: "Connected" });
  });

  it("warns when the database probe is down", () => {
    const { result } = renderHook(() => useSystemStatus(), {
      wrapper: wrapperFor({ apiStatus: "ok", environment: "test", database: "unavailable" }),
    });
    expect(result.current).toMatchObject({ variant: "warning", label: "Database unavailable" });
  });
});

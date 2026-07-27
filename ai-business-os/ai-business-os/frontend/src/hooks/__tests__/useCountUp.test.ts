import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCountUp } from "../useCountUp";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("useCountUp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the target immediately, with no animation, under prefers-reduced-motion", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useCountUp(42));
    // No waitFor/act-based animation frame needed — this must be correct
    // synchronously on mount, per Design Constitution §10.
    expect(result.current).toBe(42);
  });

  it("eventually settles at the target when motion is not reduced", async () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCountUp(10));
    await waitFor(() => expect(result.current).toBe(10));
  });

  it("starts below the target when motion is not reduced (it actually animates)", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCountUp(1000));
    expect(result.current).toBeLessThan(1000);
  });
});

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_ENTRY_FAILSAFE_MS,
  AuthEntryOverlay,
} from "../auth-entry-overlay";
import { useUiStore } from "@/stores/ui";

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

describe("AuthEntryOverlay", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    useUiStore.getState().clearAuthEntry();
  });

  afterEach(() => {
    vi.useRealTimers();
    useUiStore.getState().clearAuthEntry();
  });

  it("does not render when inactive", () => {
    render(<AuthEntryOverlay />);
    expect(screen.queryByTestId("auth-entry-overlay")).not.toBeInTheDocument();
  });

  it("renders when active as aria-hidden presentation with pointer-events none", () => {
    useUiStore.getState().armAuthEntry();
    render(<AuthEntryOverlay />);
    const overlay = screen.getByTestId("auth-entry-overlay");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).toHaveStyle({ pointerEvents: "none" });
    expect(overlay).toHaveAttribute("data-motion", "full");
  });

  it("clears after the overlay animation completes", () => {
    useUiStore.getState().armAuthEntry();
    render(<AuthEntryOverlay />);
    const overlay = screen.getByTestId("auth-entry-overlay");
    act(() => {
      overlay.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(screen.queryByTestId("auth-entry-overlay")).not.toBeInTheDocument();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });

  it("does not clear when a child animation ends", () => {
    useUiStore.getState().armAuthEntry();
    const { container } = render(<AuthEntryOverlay />);
    const field = container.querySelector(".auth-immersion-field");
    expect(field).not.toBeNull();
    act(() => {
      field!.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(screen.getByTestId("auth-entry-overlay")).toBeInTheDocument();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
  });

  it("fail-safe clears the overlay if animationend never fires", () => {
    vi.useFakeTimers();
    useUiStore.getState().armAuthEntry();
    render(<AuthEntryOverlay />);
    expect(screen.getByTestId("auth-entry-overlay")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(AUTH_ENTRY_FAILSAFE_MS);
    });
    expect(screen.queryByTestId("auth-entry-overlay")).not.toBeInTheDocument();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });

  it("uses the reduced-motion path without spatial children animation", () => {
    mockMatchMedia(true);
    useUiStore.getState().armAuthEntry();
    render(<AuthEntryOverlay />);
    const overlay = screen.getByTestId("auth-entry-overlay");
    expect(overlay).toHaveAttribute("data-motion", "reduce");
    expect(overlay).toHaveClass("auth-immersion--reduce");
    act(() => {
      overlay.dispatchEvent(new Event("animationend", { bubbles: true }));
    });
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });

  it("clears the fail-safe timeout on unmount", () => {
    vi.useFakeTimers();
    useUiStore.getState().armAuthEntry();
    const { unmount } = render(<AuthEntryOverlay />);
    unmount();
    act(() => {
      vi.advanceTimersByTime(AUTH_ENTRY_FAILSAFE_MS);
    });
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
  });
});

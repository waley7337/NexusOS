import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpaceField } from "../space-field";
import { useUiStore } from "@/stores/ui";
import {
  CINEMATIC_ELEVATE_MS,
  CINEMATIC_FAILSAFE_MS,
  CINEMATIC_TOTAL_MS,
} from "@/lib/auth-cinematic";

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

function reset() {
  useUiStore.getState().clearAuthEntry();
  useUiStore.getState().setSpaceStage("off");
}

describe("SpaceField", () => {
  beforeEach(() => {
    mockMatchMedia(false);
    reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    reset();
  });

  it("is absent on ordinary routes", () => {
    render(<SpaceField />);
    expect(screen.queryByTestId("space-field")).not.toBeInTheDocument();
  });

  it("renders the sign-in sky as an inert decorative layer", () => {
    act(() => useUiStore.getState().setSpaceStage("idle"));
    render(<SpaceField />);
    const field = screen.getByTestId("space-field");

    expect(field).toHaveAttribute("aria-hidden", "true");
    expect(field).toHaveStyle({ pointerEvents: "none" });
    expect(field).toHaveAttribute("data-space-stage", "idle");
    // At rest it must stay BELOW the sign-in surface.
    expect(field).toHaveAttribute("data-elevated", "false");
  });

  it("contains no product-shaped placeholder at any stage", () => {
    // The acceptance criterion for this whole rebuild: nothing in the auth
    // experience may look like an application. If a proxy ever comes back,
    // this is the test that should stop it.
    act(() => useUiStore.getState().armAuthEntry());
    const { container } = render(<SpaceField />);

    expect(container.querySelector('[class*="product"]')).toBeNull();
    expect(container.querySelector("[data-auth-product]")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("rises above the application only once the sign-in route has gone", () => {
    vi.useFakeTimers();
    act(() => useUiStore.getState().armAuthEntry());
    render(<SpaceField />);

    // Before the lift the card is still on screen and still receding.
    expect(screen.getByTestId("space-field")).toHaveAttribute("data-elevated", "false");

    act(() => {
      vi.advanceTimersByTime(CINEMATIC_ELEVATE_MS);
    });

    expect(screen.getByTestId("space-field")).toHaveAttribute("data-elevated", "true");
  });

  it("settles at the end of the timeline and puts the space away", () => {
    vi.useFakeTimers();
    act(() => useUiStore.getState().armAuthEntry());
    render(<SpaceField />);
    expect(screen.getByTestId("space-field")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CINEMATIC_TOTAL_MS);
    });

    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(useUiStore.getState().spaceStage).toBe("off");
    expect(screen.queryByTestId("space-field")).not.toBeInTheDocument();
  });

  it("fail-safe clears the cinematic if the timeline stalls", () => {
    vi.useFakeTimers();
    act(() => useUiStore.getState().armAuthEntry());
    render(<SpaceField />);

    act(() => {
      vi.advanceTimersByTime(CINEMATIC_FAILSAFE_MS);
    });

    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });

  it("does not settle after unmount", () => {
    vi.useFakeTimers();
    act(() => useUiStore.getState().armAuthEntry());
    const { unmount } = render(<SpaceField />);
    unmount();

    act(() => {
      vi.advanceTimersByTime(CINEMATIC_FAILSAFE_MS);
    });

    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
  });

  it("takes the reduced-motion path: no travel, immediate elevation", () => {
    mockMatchMedia(true);
    act(() => useUiStore.getState().armAuthEntry());
    render(<SpaceField />);
    const field = screen.getByTestId("space-field");

    expect(field).toHaveAttribute("data-motion", "reduce");
    expect(field).toHaveClass("space-field--reduce");
    // No deferred lift: with no card exit to protect, there is nothing to
    // wait for.
    expect(field).toHaveAttribute("data-elevated", "true");
  });
});

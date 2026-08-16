import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Starfield } from "@/components/starfield";
import { useUiStore } from "@/stores/ui";

/**
 * What is worth asserting here, and what is not.
 *
 * The starfield's output is pixels in a canvas. jsdom has no 2D context, so
 * there is nothing meaningful to assert about the drawing itself, and a
 * faked context would only assert that our own stub was called. What CAN be
 * pinned down — and what would actually break the product if it regressed —
 * is the contract around the canvas: it is decorative, it never becomes a
 * pointer or accessibility target, and it degrades to inert rather than
 * throwing when the environment cannot draw.
 */
describe("Starfield", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useUiStore.getState().setSpaceStage("off");
  });

  it("renders an inert decorative canvas", () => {
    const { container } = render(<Starfield />);
    const canvas = container.querySelector("canvas");

    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("starfield");
  });

  it("contributes nothing to the accessibility tree", () => {
    render(
      <div>
        <Starfield />
        <p>Sign in</p>
      </div>,
    );
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("starts no animation frame when the environment cannot draw", () => {
    // setup.ts makes getContext() return null, which is the same situation as
    // a browser refusing a context under memory pressure. The component must
    // go quiet, not spin a loop against a surface it cannot paint.
    const raf = vi.spyOn(window, "requestAnimationFrame");
    render(<Starfield />);
    expect(raf).not.toHaveBeenCalled();
  });

  it("tracks the space stage without re-rendering", () => {
    // The canvas must never remount when the camera speeds up — a remount
    // reseeds the sky, which is the visible cut this architecture exists to
    // avoid. Identity of the canvas node is the observable proof.
    const { container } = render(<Starfield />);
    const before = container.querySelector("canvas");

    useUiStore.getState().setSpaceStage("travel");

    expect(container.querySelector("canvas")).toBe(before);
  });

  it("unmounts cleanly", () => {
    const { unmount } = render(<Starfield stage="travel" />);
    expect(() => unmount()).not.toThrow();
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Starfield } from "@/components/starfield";
import { Atmosphere } from "@/components/atmosphere";

/**
 * What is worth asserting here, and what is not.
 *
 * The starfield's output is pixels in a canvas. jsdom has no 2D context, so
 * there is nothing meaningful to assert about the drawing itself, and a
 * faked context would only assert that our own stub was called. What CAN be
 * pinned down — and what would actually break the product if it regressed —
 * is the contract around the canvas: it is decorative, it never becomes a
 * pointer or accessibility target, it appears only where the cinematic world
 * exists, and it degrades to inert rather than throwing when the environment
 * cannot draw.
 */
describe("Starfield", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an inert decorative canvas", () => {
    const { container } = render(<Starfield />);
    const canvas = container.querySelector("canvas");

    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(canvas).toHaveClass("starfield");
  });

  it("exposes its mode so the immersion sky is distinguishable from the idle sky", () => {
    const { container, rerender } = render(<Starfield />);
    expect(container.querySelector("canvas")).toHaveAttribute("data-starfield", "drift");

    rerender(<Starfield mode="warp" />);
    expect(container.querySelector("canvas")).toHaveAttribute("data-starfield", "warp");
  });

  it("contributes nothing to the accessibility tree", () => {
    render(
      <div>
        <Starfield />
        <p>Sign in</p>
      </div>,
    );
    // The canvas is aria-hidden, so the only thing a reader sees is the copy.
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

  it("unmounts cleanly", () => {
    const { unmount } = render(<Starfield mode="warp" />);
    expect(() => unmount()).not.toThrow();
  });
});

describe("Atmosphere", () => {
  it("carries the starfield only in the cinematic variant", () => {
    const { container: plain } = render(<Atmosphere />);
    expect(plain.querySelector("canvas")).toBeNull();

    const { container: cinematic } = render(<Atmosphere variant="cinematic" />);
    expect(cinematic.querySelector("canvas")).toBeInTheDocument();
  });

  it("paints the sky beneath the light volumes", () => {
    const { container } = render(<Atmosphere variant="cinematic" />);
    const root = container.querySelector(".atmosphere");
    const children = Array.from(root?.children ?? []);
    const starsIndex = children.findIndex((el) => el.tagName === "CANVAS");
    const parallaxIndex = children.findIndex((el) =>
      el.classList.contains("atmosphere-parallax"),
    );

    // DOM order is the stacking order here — see globals.css. If the stars
    // ever move above the parallax layers they stop reading as distance.
    expect(starsIndex).toBeGreaterThanOrEqual(0);
    expect(starsIndex).toBeLessThan(parallaxIndex);
  });
});

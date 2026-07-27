import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "../sparkline";

describe("Sparkline", () => {
  it("renders a line path and a filled area path for a normal trend", () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 6, 3, 8]} />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
  });

  it("renders nothing for fewer than 2 points", () => {
    const { container } = render(<Sparkline data={[5]} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("handles a flat trend (zero range) without throwing", () => {
    expect(() => render(<Sparkline data={[3, 3, 3]} />)).not.toThrow();
  });

  it("is hidden from assistive tech (decorative, value is announced by the parent StatCard)", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

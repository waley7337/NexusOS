import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadialGauge } from "../radial-gauge";

const SEGMENTS = [
  { label: "Sales", value: 8.2, color: "hsl(var(--chart-1))" },
  { label: "Finance", value: 7.5, color: "hsl(var(--chart-2))" },
  { label: "Ops", value: 6.1, color: "hsl(var(--chart-3))" },
];

describe("RadialGauge", () => {
  it("gives the SVG a concise, accurate aria-label", () => {
    render(<RadialGauge score={7.4} scoreLabel="Health" segments={SEGMENTS} />);
    expect(screen.getByRole("img", { name: "Health score 7.4 out of 10" })).toBeInTheDocument();
  });

  it("exposes a full text-equivalent breakdown for screen readers", () => {
    const { container } = render(<RadialGauge score={7.4} scoreLabel="Health" segments={SEGMENTS} />);
    const srText = container.querySelector(".sr-only");
    expect(srText).toHaveTextContent("Health score 7.4 out of 10");
    expect(srText).toHaveTextContent("Sales 8.2");
    expect(srText).toHaveTextContent("Finance 7.5");
    expect(srText).toHaveTextContent("Ops 6.1");
  });

  // Each segment now draws two lines: an unfilled track showing the segment's
  // full range, and the value spoke on top (Part 04 convergence, Commit D).
  // Asserting on data-spoke rather than a raw <line> count keeps the test
  // about intent instead of about how many elements happen to be drawn.
  it("renders one value spoke per segment", () => {
    const { container } = render(<RadialGauge score={7.4} scoreLabel="Health" segments={SEGMENTS} />);
    expect(container.querySelectorAll('line[data-spoke="value"]')).toHaveLength(SEGMENTS.length);
  });

  it("renders a full-range track behind every value spoke", () => {
    const { container } = render(<RadialGauge score={7.4} scoreLabel="Health" segments={SEGMENTS} />);
    expect(container.querySelectorAll('line[data-spoke="track"]')).toHaveLength(SEGMENTS.length);
  });

  it("keeps a value spoke shorter than its track when the segment is below max", () => {
    const { container } = render(
      <RadialGauge score={5} scoreLabel="Health" segments={[{ label: "Ops", value: 5, color: "hsl(var(--chart-1))" }]} />,
    );
    const value = container.querySelector('line[data-spoke="value"]')!;
    const track = container.querySelector('line[data-spoke="track"]')!;
    const len = (el: Element) =>
      Math.hypot(
        Number(el.getAttribute("x2")) - Number(el.getAttribute("x1")),
        Number(el.getAttribute("y2")) - Number(el.getAttribute("y1")),
      );
    expect(len(value)).toBeLessThan(len(track));
  });

  it("respects a custom max for the aria-label", () => {
    render(<RadialGauge score={70} scoreLabel="Health" segments={SEGMENTS} max={100} />);
    expect(screen.getByRole("img", { name: "Health score 70.0 out of 100" })).toBeInTheDocument();
  });
});

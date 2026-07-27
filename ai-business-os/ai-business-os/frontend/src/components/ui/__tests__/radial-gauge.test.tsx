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

  it("renders one spoke per segment", () => {
    const { container } = render(<RadialGauge score={7.4} scoreLabel="Health" segments={SEGMENTS} />);
    expect(container.querySelectorAll("line")).toHaveLength(SEGMENTS.length);
  });

  it("respects a custom max for the aria-label", () => {
    render(<RadialGauge score={70} scoreLabel="Health" segments={SEGMENTS} max={100} />);
    expect(screen.getByRole("img", { name: "Health score 70.0 out of 100" })).toBeInTheDocument();
  });
});

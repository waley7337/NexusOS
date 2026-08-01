import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressListItem } from "../progress-list-item";

describe("ProgressListItem", () => {
  it("renders the title and percent", () => {
    render(<ProgressListItem title="Ship the career pivot" percent={72} />);
    expect(screen.getByText("Ship the career pivot")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders an optional description", () => {
    render(<ProgressListItem title="Build a runway" description="Reach $150k" percent={64} />);
    expect(screen.getByText("Reach $150k")).toBeInTheDocument();
  });

  it("clamps the progressbar value to 0-100", () => {
    render(<ProgressListItem title="Overshoot" percent={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});

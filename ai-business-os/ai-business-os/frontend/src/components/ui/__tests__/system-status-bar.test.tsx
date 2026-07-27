import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SystemStatusBar } from "../system-status-bar";

describe("SystemStatusBar", () => {
  it("renders sensible defaults with no props", () => {
    render(<SystemStatusBar />);
    expect(screen.getByText("All systems nominal")).toBeInTheDocument();
  });

  it("omits the detail line when not provided", () => {
    const { container } = render(<SystemStatusBar />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders the detail line when provided", () => {
    render(<SystemStatusBar detail="Synced 2 min ago" />);
    expect(screen.getByText("Synced 2 min ago")).toBeInTheDocument();
  });
});

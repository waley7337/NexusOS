import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatCard } from "../stat-card";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Revenue" value="$128,430" />);
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("$128,430")).toBeInTheDocument();
  });

  it("renders a positive delta pill", () => {
    render(<StatCard label="Revenue" value="$128,430" delta={18} />);
    expect(screen.getByText("18%")).toBeInTheDocument();
  });

  it("omits the delta pill when delta is not provided", () => {
    render(<StatCard label="Inventory alerts" value="3" />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("renders the icon chip when an icon is provided", () => {
    const { container } = render(<StatCard label="Revenue" value="$128,430" icon={Wallet} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("omits the sparkline when trend has fewer than 2 points", () => {
    const { container } = render(<StatCard label="Revenue" value="$128,430" trend={[5]} />);
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("renders the sparkline when trend has 2+ points", () => {
    const { container } = render(<StatCard label="Revenue" value="$128,430" trend={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

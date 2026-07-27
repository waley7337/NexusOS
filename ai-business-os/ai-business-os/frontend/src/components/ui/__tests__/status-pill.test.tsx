import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "../status-pill";

describe("StatusPill", () => {
  it("renders the label", () => {
    render(<StatusPill label="All systems nominal" />);
    expect(screen.getByText("All systems nominal")).toBeInTheDocument();
  });

  it("pulses only the online variant", () => {
    const { container: online } = render(<StatusPill label="Online" variant="online" />);
    expect(online.querySelector(".pulse-live")).toBeInTheDocument();

    const { container: offline } = render(<StatusPill label="Offline" variant="offline" />);
    expect(offline.querySelector(".pulse-live")).not.toBeInTheDocument();
  });

  it("hides the dot from screen readers", () => {
    const { container } = render(<StatusPill label="Online" />);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});

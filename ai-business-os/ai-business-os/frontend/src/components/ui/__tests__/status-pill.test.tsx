import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "../status-pill";

describe("StatusPill", () => {
  it("renders the label", () => {
    render(<StatusPill label="All systems nominal" />);
    expect(screen.getByText("All systems nominal")).toBeInTheDocument();
  });

  // The animation moved from an opacity pulse on the dot itself to an
  // expanding halo ring behind it (Part 04 convergence, Commit C). The
  // guarantee under test is unchanged: only a healthy system animates — a
  // degraded or offline one must sit still rather than animate reassuringly.
  it("animates only the online variant", () => {
    const { container: online } = render(<StatusPill label="Online" variant="online" />);
    expect(online.querySelector(".animate-ping")).toBeInTheDocument();

    const { container: offline } = render(<StatusPill label="Offline" variant="offline" />);
    expect(offline.querySelector(".animate-ping")).not.toBeInTheDocument();

    const { container: warning } = render(<StatusPill label="Syncing" variant="warning" />);
    expect(warning.querySelector(".animate-ping")).not.toBeInTheDocument();
  });

  it("keeps the dot a fixed size so a status change cannot reflow the row", () => {
    const { container } = render(<StatusPill label="Online" variant="online" />);
    // The halo is a separate absolutely-positioned span; the dot itself is
    // always h-1.5 w-1.5 regardless of variant.
    expect(container.querySelector(".relative.inline-flex.h-1\\.5.w-1\\.5")).toBeInTheDocument();
  });

  it("hides the dot from screen readers", () => {
    const { container } = render(<StatusPill label="Online" />);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../page-header";

describe("PageHeader", () => {
  it("renders the title as a focusable h1 (route-focus compatible)", () => {
    render(<PageHeader title="CRM" />);
    const heading = screen.getByRole("heading", { level: 1, name: "CRM" });
    expect(heading).toHaveAttribute("tabIndex", "-1");
  });

  it("omits eyebrow/status row, actions, and description when not provided", () => {
    const { container } = render(<PageHeader title="CRM" />);
    expect(container.querySelector(".text-caption")).not.toBeInTheDocument();
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders eyebrow, description, actions, and status when provided", () => {
    render(
      <PageHeader
        eyebrow="Mission control"
        title="Dashboard"
        description={
          <>
            This week's directive — <span className="text-primary">protect the deep work</span>.
          </>
        }
        actions={<button type="button">Capture</button>}
        status={<span data-testid="status-slot">Operational</span>}
      />,
    );

    expect(screen.getByText("Mission control")).toBeInTheDocument();
    expect(screen.getByText(/protect the deep work/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Capture" })).toBeInTheDocument();
    expect(screen.getByTestId("status-slot")).toBeInTheDocument();
  });

  it("renders as h2 when a page already has its own h1 (e.g. /design's demo)", () => {
    render(<PageHeader as="h2" title="Good morning, Waley" />);
    expect(screen.getByRole("heading", { level: 2, name: "Good morning, Waley" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("merges a caller className onto the root", () => {
    const { container } = render(<PageHeader title="CRM" className="mb-4" />);
    expect(container.firstElementChild).toHaveClass("mb-4");
  });
});

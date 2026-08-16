import { Inbox } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("marks the decorative icon as hidden from assistive tech", () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Nothing here" description="This space is empty." />,
    );

    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("heading", { level: 3, name: "Nothing here" })).toBeInTheDocument();
  });

  it("can render the title as the page h1 for standalone error screens", () => {
    render(
      <EmptyState as="h1" icon={Inbox} title="Page not found" description="That URL does not match." />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
  });
});

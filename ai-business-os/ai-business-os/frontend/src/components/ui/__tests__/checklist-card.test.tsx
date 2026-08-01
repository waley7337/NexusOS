import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChecklistCard } from "../checklist-card";

describe("ChecklistCard", () => {
  it("renders the label and an optional tag", () => {
    render(<ChecklistCard label="Draft the promotion thesis" tag="Career" />);
    expect(screen.getByText("Draft the promotion thesis")).toBeInTheDocument();
    expect(screen.getByText("Career")).toBeInTheDocument();
  });

  it("omits the tag badge when not provided", () => {
    const { container } = render(<ChecklistCard label="Deep work block" />);
    expect(container.querySelector(".rounded-full")).not.toBeInTheDocument();
  });

  it("fires onCheckedChange with a plain boolean when toggled", async () => {
    const onCheckedChange = vi.fn();
    render(<ChecklistCard label="Deep work block" onCheckedChange={onCheckedChange} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("associates the label with the checkbox for screen readers", () => {
    render(<ChecklistCard label="Deep work block" />);
    expect(screen.getByRole("checkbox", { name: "Deep work block" })).toBeInTheDocument();
  });
});

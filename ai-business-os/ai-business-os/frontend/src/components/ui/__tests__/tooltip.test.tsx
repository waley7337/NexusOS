import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { IconTooltip, TooltipProvider } from "../tooltip";

describe("Tooltip", () => {
  it("shows the label on hover of a named icon control", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <IconTooltip label="Notifications">
          <button type="button" aria-label="Notifications">Bell</button>
        </IconTooltip>
      </TooltipProvider>,
    );

    await user.hover(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Notifications");
  });

  it("shows on keyboard focus and dismisses on Escape", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <IconTooltip label="Notifications">
          <button type="button" aria-label="Notifications">Bell</button>
        </IconTooltip>
      </TooltipProvider>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Notifications");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

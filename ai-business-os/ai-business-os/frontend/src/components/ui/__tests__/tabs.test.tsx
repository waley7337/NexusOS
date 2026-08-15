import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

describe("Tabs", () => {
  it("moves selection with click and keeps panels associated", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabsList>
          <TabsTrigger value="one">Overview</TabsTrigger>
          <TabsTrigger value="two">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Overview panel</TabsContent>
        <TabsContent value="two">Activity panel</TabsContent>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Overview panel")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.getByRole("tab", { name: "Activity" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Activity panel")).toBeVisible();
  });
});

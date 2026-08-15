import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "../drawer";

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open drawer</button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader title="Notifications" />
          <DrawerBody>Panel body</DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("opens and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Notifications");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("releases the overlay so the opener can be used again after Escape", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open drawer" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("closes the open drawer on Escape when a second closed drawer is also mounted", async () => {
    const user = userEvent.setup();

    function DualDrawerHarness() {
      const [notificationsOpen, setNotificationsOpen] = useState(false);
      return (
        <>
          <Drawer open={false} onOpenChange={() => undefined}>
            <DrawerContent side="left">
              <DrawerHeader title="NexusOS" />
            </DrawerContent>
          </Drawer>
          <button type="button" onClick={() => setNotificationsOpen(true)}>
            Open notifications
          </button>
          <Drawer open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <DrawerContent>
              <DrawerHeader title="Notifications" />
              <DrawerBody>Panel body</DrawerBody>
            </DrawerContent>
          </Drawer>
        </>
      );
    }

    render(<DualDrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Open notifications" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Notifications");

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

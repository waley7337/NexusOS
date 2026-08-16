import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DataTable } from "../data-table";

const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "role", header: "Role" },
];

const data = [{ name: "Ada", role: "Admin" }];

describe("DataTable columns menu", () => {
  it("opens a keyboard-accessible column menu and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    await user.click(screen.getByRole("button", { name: /columns/i }));
    expect(await screen.findByRole("menuitemcheckbox", { name: "Name" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menuitemcheckbox")).not.toBeInTheDocument();
    });
  });

  it("keeps row content after toggling a column off", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={data} />);

    expect(screen.getByText("Ada")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /columns/i }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Role" }));
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });
});

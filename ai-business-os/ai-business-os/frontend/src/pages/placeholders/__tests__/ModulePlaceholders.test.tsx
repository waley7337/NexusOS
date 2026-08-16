import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AssistantPlaceholder,
  DocumentsPlaceholder,
  FinancePlaceholder,
  HrPlaceholder,
  InventoryPlaceholder,
  ProjectsPlaceholder,
  ReportsPlaceholder,
  SettingsPlaceholder,
  TasksPlaceholder,
} from "../ModulePlaceholders";

const placeholders = [
  ["Projects", ProjectsPlaceholder],
  ["Tasks", TasksPlaceholder],
  ["HR", HrPlaceholder],
  ["Finance", FinancePlaceholder],
  ["Inventory", InventoryPlaceholder],
  ["Documents", DocumentsPlaceholder],
  ["Reports", ReportsPlaceholder],
  ["AI Assistant", AssistantPlaceholder],
  ["Settings", SettingsPlaceholder],
] as const;

describe("module placeholders", () => {
  it.each(placeholders)("%s is an honest empty module with no fake actions", (_title, Placeholder) => {
    render(<Placeholder />);

    expect(screen.getByText("Not operational yet")).toBeInTheDocument();
    expect(
      screen.getByText("This module has no API yet. NexusOS does not invent records, metrics, or actions here."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/create customer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/open settings/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all visual/i)).not.toBeInTheDocument();
  });

  it("does not claim Finance is already visual", () => {
    render(<FinancePlaceholder />);
    expect(screen.getByText("Revenue, expenses, invoices, and payments.")).toBeInTheDocument();
  });
});

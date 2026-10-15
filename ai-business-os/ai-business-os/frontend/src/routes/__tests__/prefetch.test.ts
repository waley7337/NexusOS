import { describe, expect, it } from "vitest";
import { FINANCE_FEATURE_MODULE_ID } from "../prefetch";
import { ROUTES } from "@/constants/routes";

describe("finance route prefetch", () => {
  it("targets the live finance feature module instead of ModulePlaceholders", () => {
    expect(FINANCE_FEATURE_MODULE_ID).toBe("@/features/finance");
    expect(FINANCE_FEATURE_MODULE_ID).not.toContain("placeholders");
  });

  it("resolves the finance feature exports used by lazy routes", async () => {
    const feature = await import("@/features/finance");
    expect(feature.InvoicesPage).toBeTypeOf("function");
    expect(feature.InvoiceDetailPage).toBeTypeOf("function");
    expect(feature.ExpensesPage).toBeTypeOf("function");
  });
});

describe("live module route prefetch", () => {
  it("prefetches reports/projects/settings from live pages, not placeholders", async () => {
    // Keep registry imports aligned with routes/index.tsx lazy targets.
    const reports = await import("@/pages/reports");
    const projects = await import("@/pages/projects");
    const tasks = await import("@/pages/tasks");
    const inventory = await import("@/pages/inventory");
    const settings = await import("@/pages/settings");
    const assistant = await import("@/pages/assistant");

    expect(reports.ReportsPage).toBeTypeOf("function");
    expect(projects.ProjectsPage).toBeTypeOf("function");
    expect(tasks.TasksPage).toBeTypeOf("function");
    expect(inventory.InventoryPage).toBeTypeOf("function");
    expect(settings.SettingsPage).toBeTypeOf("function");
    expect(assistant.AssistantPage).toBeTypeOf("function");

    // Documents remain a placeholder by product design.
    expect(ROUTES.documents).toBe("/documents");
  });
});

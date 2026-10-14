import { describe, expect, it } from "vitest";
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from "../index";

describe("project/task wire enums", () => {
  it("matches backend ProjectStatus values (not legacy planning/cancelled)", () => {
    expect(PROJECT_STATUSES).toEqual([
      "planned",
      "active",
      "on_hold",
      "completed",
      "archived",
    ]);
    expect(PROJECT_STATUSES).not.toContain("planning");
    expect(PROJECT_STATUSES).not.toContain("cancelled");
  });

  it("matches backend TaskStatus values including backlog and US spelling canceled", () => {
    expect(TASK_STATUSES).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "in_review",
      "done",
      "canceled",
    ]);
    expect(TASK_STATUSES).not.toContain("cancelled");
  });

  it("matches backend Priority values", () => {
    expect(TASK_PRIORITIES).toEqual(["low", "medium", "high", "urgent"]);
  });
});

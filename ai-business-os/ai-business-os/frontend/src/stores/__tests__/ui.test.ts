import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../ui";

describe("useUiStore auth-entry presentation flag", () => {
  beforeEach(() => {
    useUiStore.getState().clearAuthEntry();
  });

  it("defaults inactive", () => {
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });

  it("can arm and clear", () => {
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    useUiStore.getState().clearAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });

  it("is not written to localStorage", () => {
    const before = localStorage.length;
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(localStorage.length).toBe(before);
  });
});

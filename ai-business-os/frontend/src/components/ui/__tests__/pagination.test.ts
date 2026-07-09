import { describe, expect, it } from "vitest";
import { pageWindow } from "../pagination";

describe("pageWindow", () => {
  it("shows all pages when few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("windows around the current page with ellipses", () => {
    expect(pageWindow(6, 20)).toEqual([1, "…", 5, 6, 7, "…", 20]);
  });
  it("handles edges without leading/trailing gaps", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, "…", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "…", 19, 20]);
  });
});

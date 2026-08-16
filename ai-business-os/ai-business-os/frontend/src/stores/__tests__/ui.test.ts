import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../ui";

describe("useUiStore auth-entry presentation flag", () => {
  beforeEach(() => {
    useUiStore.getState().clearAuthEntry();
    useUiStore.getState().clearCinematicReveal();
  });

  it("defaults inactive", () => {
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(useUiStore.getState().pendingCinematicReveal).toBe(false);
  });

  it("can arm and clear", () => {
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(useUiStore.getState().pendingCinematicReveal).toBe(true);
    useUiStore.getState().clearAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(useUiStore.getState().immersionOrigin).toBeNull();
    expect(useUiStore.getState().pendingCinematicReveal).toBe(true);
    useUiStore.getState().clearCinematicReveal();
    expect(useUiStore.getState().pendingCinematicReveal).toBe(false);
  });

  it("captures immersion origin from the auth product when present", () => {
    const host = document.createElement("div");
    host.setAttribute("data-auth-product", "");
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({
        left: 100,
        top: 80,
        width: 640,
        height: 400,
        right: 740,
        bottom: 480,
        x: 100,
        y: 80,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(host);
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().immersionOrigin).toEqual({
      left: 100,
      top: 80,
      width: 640,
      height: 400,
    });
    host.remove();
  });

  it("is not written to localStorage", () => {
    const before = localStorage.length;
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(localStorage.length).toBe(before);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../ui";

describe("useUiStore auth-entry presentation flag", () => {
  beforeEach(() => {
    useUiStore.getState().clearAuthEntry();
    useUiStore.getState().clearCinematicReveal();
    useUiStore.getState().setSpaceStage("off");
  });

  it("defaults inactive", () => {
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(useUiStore.getState().pendingCinematicReveal).toBe(false);
    expect(useUiStore.getState().spaceStage).toBe("off");
  });

  it("can arm and clear", () => {
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(useUiStore.getState().pendingCinematicReveal).toBe(true);
    useUiStore.getState().clearAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(useUiStore.getState().spaceStage).toBe("off");
    expect(useUiStore.getState().pendingCinematicReveal).toBe(true);
    useUiStore.getState().clearCinematicReveal();
    expect(useUiStore.getState().pendingCinematicReveal).toBe(false);
  });

  it("arming hands the space over to the camera, without remounting it", () => {
    // The sky is already running on the sign-in route. Arming must only
    // change its phase — anything that reset it to "off" first would
    // unmount the canvas and reseed the field mid-transition.
    useUiStore.getState().setSpaceStage("idle");
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().spaceStage).toBe("travel");
  });

  it("is not written to localStorage", () => {
    const before = localStorage.length;
    useUiStore.getState().armAuthEntry();
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(localStorage.length).toBe(before);
  });
});

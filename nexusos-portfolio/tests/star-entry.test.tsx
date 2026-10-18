import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CINEMATIC_CARD_EXIT_MS } from "@/lib/auth-cinematic";
import { useUiStore } from "@/stores/ui";
import { StarEntry } from "~/animations/StarEntry";

describe("StarEntry drives the real NexusOS cinematic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({ spaceStage: "off", isAuthEntryActive: false, pendingCinematicReveal: false });
  });
  afterEach(() => vi.useRealTimers());

  it("claims the space as idle on mount", () => {
    render(<StarEntry onEnter={() => {}} />);
    expect(useUiStore.getState().spaceStage).toBe("idle");
  });

  it("arms travel immediately and swaps after the card exit", () => {
    const onEnter = vi.fn();
    render(<StarEntry onEnter={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: /enter portfolio/i }));

    expect(useUiStore.getState().spaceStage).toBe("travel");
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(screen.getByTestId("star-entry")).toHaveAttribute("data-auth-stage", "leaving");
    expect(onEnter).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(CINEMATIC_CARD_EXIT_MS));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});

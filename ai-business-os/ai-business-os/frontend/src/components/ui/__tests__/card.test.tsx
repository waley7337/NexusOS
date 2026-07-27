import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../card";

describe("Card", () => {
  it("defaults to the solid variant, unchanged from pre-Phase-2 output", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toBe("rounded-xl border bg-card text-card-foreground");
  });

  it("solid variant explicitly matches the default", () => {
    render(<Card data-testid="card" variant="solid">Content</Card>);
    expect(screen.getByTestId("card").className).toBe("rounded-xl border bg-card text-card-foreground");
  });

  it("glass variant renders the surface-glass utility instead of the solid surface", () => {
    render(<Card data-testid="card" variant="glass">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("surface-glass");
    expect(card.className).not.toContain("bg-card");
    expect(card.className).not.toMatch(/(^| )border( |$)/);
  });

  it("merges a caller className on top of the variant classes", () => {
    render(<Card data-testid="card" variant="glass" className="max-w-xs" />);
    expect(screen.getByTestId("card").className).toContain("max-w-xs");
  });
});

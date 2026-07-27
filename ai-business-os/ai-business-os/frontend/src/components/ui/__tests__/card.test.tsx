import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../card";

describe("Card", () => {
  // The solid surface moved from inline utilities (`rounded-xl border bg-card`,
  // which measured boxShadow: none) to the .surface recipe — ladder fill +
  // translucent hairline + inset top highlight + drop shadow (Part 04
  // convergence, Commit C).
  it("defaults to the solid .surface recipe", () => {
    render(<Card data-testid="card">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("surface");
    expect(card.className).not.toContain("surface-glass");
  });

  it("solid variant explicitly matches the default", () => {
    render(<Card data-testid="card" variant="solid">Content</Card>);
    expect(screen.getByTestId("card").className).toContain("surface");
  });

  it("glass variant renders the surface-glass utility instead of the solid surface", () => {
    render(<Card data-testid="card" variant="glass">Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("surface-glass");
  });

  it("is static by default and only lifts when explicitly interactive", () => {
    const { rerender } = render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId("card").className).not.toContain("card-lift");

    rerender(<Card data-testid="card" interactive>Content</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("card-lift");
    expect(card.className).toContain("spotlight");
  });

  it("merges a caller className on top of the variant classes", () => {
    render(<Card data-testid="card" variant="glass" className="max-w-xs" />);
    expect(screen.getByTestId("card").className).toContain("max-w-xs");
  });
});

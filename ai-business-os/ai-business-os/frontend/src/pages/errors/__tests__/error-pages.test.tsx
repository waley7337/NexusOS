import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ROUTES } from "@/constants/routes";
import { ForbiddenPage } from "../ForbiddenPage";
import { NotFoundPage } from "../NotFoundPage";

describe("error pages", () => {
  it("renders 404 with an EmptyState and a dashboard link", () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", ROUTES.home);
  });

  it("renders 403 with an EmptyState and a dashboard link", () => {
    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Access denied" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", ROUTES.home);
  });
});

import { lazy, type ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "framer-motion";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LazyOutlet } from "../LazyOutlet";

function renderShell(initialEntries: string[] = ["/"]) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <div>
            <nav data-testid="shell-nav">
              <Link to="/">Dashboard</Link>
              <Link to="/crm">CRM</Link>
              <Link to="/projects">Projects</Link>
              <Link to="/settings">Settings</Link>
            </nav>
            <main>
              <LazyOutlet />
            </main>
          </div>
        ),
        children: [
          { path: "/", element: <h1>Dashboard</h1> },
          { path: "/crm", element: <h1>CRM</h1> },
          { path: "/projects", element: <h1>Projects</h1> },
          { path: "/settings", element: <h1>Settings</h1> },
        ],
      },
    ],
    { initialEntries },
  );

  return {
    router,
    ...render(<RouterProvider router={router} />),
  };
}

describe("LazyOutlet route transitions", () => {
  it("keeps the shell mounted while route content changes", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(screen.getByTestId("shell-nav")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "CRM" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "CRM" })).toBeVisible();
    });
    expect(screen.getByTestId("shell-nav")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("rapid navigation settles on the last selected route without leftover pages", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("link", { name: "CRM" }));
    await user.click(screen.getByRole("link", { name: "Projects" }));
    await user.click(screen.getByRole("link", { name: "Settings" }));
    await user.click(screen.getByRole("link", { name: "Dashboard" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    });
    expect(screen.queryByRole("heading", { name: "CRM" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByTestId("shell-nav")).toBeInTheDocument();
  });

  it("renders content under reduced motion without blocking navigation", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          element: (
            <MotionConfig reducedMotion="always">
              <nav data-testid="shell-nav">
                <Link to="/crm">CRM</Link>
              </nav>
              <LazyOutlet />
            </MotionConfig>
          ),
          children: [
            { path: "/", element: <h1>Dashboard</h1> },
            { path: "/crm", element: <h1>CRM</h1> },
          ],
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    await user.click(screen.getByRole("link", { name: "CRM" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "CRM" })).toBeVisible();
    });
  });

  it("shows the route loading fallback while a lazy chunk is pending", async () => {
    let release: (value: { default: () => ReactElement }) => void = () => {};
    const SlowPage = lazy(
      () =>
        new Promise<{ default: () => ReactElement }>((resolve) => {
          release = resolve;
        }),
    );

    const router = createMemoryRouter(
      [
        {
          element: <LazyOutlet />,
          children: [
            { path: "/", element: <h1>Dashboard</h1> },
            { path: "/slow", element: <SlowPage /> },
          ],
        },
      ],
      { initialEntries: ["/slow"] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByLabelText("Loading page")).toBeInTheDocument();

    release({ default: () => <h1>Slow</h1> });

    expect(await screen.findByRole("heading", { name: "Slow" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText("Loading page")).not.toBeInTheDocument();
    });
  });

  it("skips enter on first paint and applies it on the next route", async () => {
    const user = userEvent.setup();
    renderShell();

    expect(document.querySelector("[data-route-surface]")).not.toHaveClass("route-enter");

    await user.click(screen.getByRole("link", { name: "CRM" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "CRM" })).toBeVisible();
    });
    expect(document.querySelector("[data-route-surface]")).toHaveClass("route-enter");
  });

  it("settles the enter surface so it cannot remain at the from-keyframe", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("link", { name: "CRM" }));

    await waitFor(() => {
      expect(document.querySelector("[data-route-surface]")).toHaveClass("route-enter-settled");
    });
    expect(screen.getByRole("heading", { name: "CRM" })).toBeVisible();
  });

  it("does not attach enter to the landing surface after an unrelated rerender", async () => {
    const { rerender, router } = renderShell();

    expect(document.querySelector("[data-route-surface]")).not.toHaveClass("route-enter");

    rerender(<RouterProvider router={router} />);

    expect(document.querySelector("[data-route-surface]")).not.toHaveClass("route-enter");
  });
});

/**
 * Regression: RR7 default startTransition + LazyOutlet Suspense can keep the
 * previous outlet painted while the URL has already moved (Dashboard stuck at
 * /crm). App.tsx sets useTransitions={false}; this test locks that contract
 * for a suspending CRM leaf under LazyOutlet.
 */
import { lazy, type ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  createRoutesFromElements,
  Link,
  Route,
  RouterProvider,
} from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LazyOutlet } from "../LazyOutlet";

const DelayedCrmLanding = lazy(
  () =>
    new Promise<{ default: () => ReactElement }>((resolve) => {
      window.setTimeout(() => {
        resolve({
          default: function CrmLanding() {
            return <h1>CRM Landing</h1>;
          },
        });
      }, 300);
    }),
);

function renderShell(useTransitions: boolean) {
  const router = createMemoryRouter(
    createRoutesFromElements(
      <Route
        element={
          <div>
            <Link to="/">Dashboard</Link>
            <Link to="/crm">CRM</Link>
            <LazyOutlet />
          </div>
        }
      >
        <Route path="/" element={<h1>DashboardPage</h1>} />
        <Route path="/crm" element={<DelayedCrmLanding />} />
      </Route>,
    ),
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} useTransitions={useTransitions} />);
}

describe("LazyOutlet + RouterProvider transitions", () => {
  it("useTransitions={false} does not keep Dashboard painted while /crm suspends", async () => {
    const user = userEvent.setup();
    renderShell(false);

    expect(screen.getByRole("heading", { name: "DashboardPage" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "CRM" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "DashboardPage" })).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/loading page/i)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "CRM Landing" })).toBeInTheDocument();
  });
});

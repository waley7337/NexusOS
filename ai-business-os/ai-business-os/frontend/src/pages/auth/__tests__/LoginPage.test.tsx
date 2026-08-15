import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../LoginPage";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const mockLogin = vi.fn();
vi.mock("@/features/auth/services/authService", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

const mockPrefetchRoute = vi.fn();
vi.mock("@/routes/prefetch", () => ({
  prefetchRoute: (...args: unknown[]) => mockPrefetchRoute(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

const loginSuccess = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: {
    id: "u1",
    email: "jane@acme.com",
    firstName: "Jane",
    lastName: "Doe",
    fullName: "Jane Doe",
    role: "owner",
    companyId: "c1",
    companyName: "Acme",
    companySlug: "acme",
    emailVerified: false,
  },
};

function renderLoginPage(initialEntries: string[] = ["/login"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard home</div>} />
          <Route path="/projects" element={<div>Projects page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndSubmit(submitVia: "click" | "enter" = "click") {
  await userEvent.type(screen.getByLabelText("Company URL"), "acme");
  await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
  await userEvent.type(screen.getByLabelText("Password"), "Secret123");
  if (submitVia === "enter") {
    await userEvent.keyboard("{Enter}");
    return;
  }
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockPrefetchRoute.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    useAuthStore.getState().clear();
    useUiStore.getState().clearAuthEntry();
  });

  it("shows validation errors for missing company URL, invalid email, and empty password", async () => {
    renderLoginPage();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Company URL is required")).toBeInTheDocument();
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("logs in and redirects home on success", async () => {
    mockLogin.mockResolvedValue(loginSuccess);

    renderLoginPage();
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    expect(useAuthStore.getState().accessToken).toBe("access-1");
    expect(useAuthStore.getState().user?.email).toBe("jane@acme.com");
    expect(mockToastSuccess).toHaveBeenCalledWith("Signed in.");
  });

  it("redirects to the originally requested URL after login", async () => {
    mockLogin.mockResolvedValue(loginSuccess);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[{ pathname: "/login", state: { from: { pathname: "/projects" } } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/projects" element={<div>Projects page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Projects page")).toBeInTheDocument());
  });

  it("shows an error toast on invalid credentials", async () => {
    const { ApiRequestError } = await import("@/api/client");
    mockLogin.mockRejectedValue(new ApiRequestError("Invalid email or password.", []));

    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Company URL"), "acme");
    await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "WrongPass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Invalid email or password."));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it("shows a toast when landing with ?sessionExpired=1", async () => {
    renderLoginPage(["/login?sessionExpired=1"]);
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Your session expired — sign in to continue."),
    );
  });

  it("arms the auth-entry transition and prefetches home after a successful intentional login", async () => {
    mockLogin.mockResolvedValue(loginSuccess);
    renderLoginPage();
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(mockPrefetchRoute).toHaveBeenCalledTimes(1);
    expect(mockPrefetchRoute).toHaveBeenCalledWith("/");
  });

  it("prefetches the actual redirect destination and navigates immediately", async () => {
    mockLogin.mockResolvedValue(loginSuccess);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={[{ pathname: "/login", state: { from: { pathname: "/projects" } } }]}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/projects" element={<div>Projects page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Projects page")).toBeInTheDocument());
    expect(mockPrefetchRoute).toHaveBeenCalledWith("/projects");
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
  });

  it("does not arm the transition or prefetch on failed login", async () => {
    const { ApiRequestError } = await import("@/api/client");
    mockLogin.mockRejectedValue(new ApiRequestError("Invalid email or password.", []));
    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Company URL"), "acme");
    await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "WrongPass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Invalid email or password."));
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(mockPrefetchRoute).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("keeps authentication valid if the presentation overlay is cleared", async () => {
    mockLogin.mockResolvedValue(loginSuccess);
    renderLoginPage();
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    useUiStore.getState().clearAuthEntry();
    expect(useAuthStore.getState().accessToken).toBe("access-1");
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(screen.getByText("Dashboard home")).toBeInTheDocument();
  });

  it("does not replay the transition for a returning authenticated user", async () => {
    useAuthStore.getState().setTokens("access-1", "refresh-1");
    useAuthStore.getState().setUser({
      id: "u1",
      email: "jane@acme.com",
      name: "Jane Doe",
      role: "owner",
      companyId: "c1",
      companyName: "Acme",
      companySlug: "acme",
      emailVerified: false,
    });
    renderLoginPage();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(mockPrefetchRoute).not.toHaveBeenCalled();
  });

  it("does not arm the transition while login is still pending", async () => {
    let resolveLogin: (value: typeof loginSuccess) => void = () => {};
    mockLogin.mockImplementation(
      () =>
        new Promise<typeof loginSuccess>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    renderLoginPage();
    await fillAndSubmit();

    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
    expect(mockPrefetchRoute).not.toHaveBeenCalled();

    resolveLogin(loginSuccess);
    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
  });

  it("submits from the keyboard with Enter", async () => {
    mockLogin.mockResolvedValue(loginSuccess);
    renderLoginPage();
    await fillAndSubmit("enter");

    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
    expect(mockPrefetchRoute).toHaveBeenCalledWith("/");
  });

  it("does not let reduced motion block navigation", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    mockLogin.mockResolvedValue(loginSuccess);
    renderLoginPage();
    await fillAndSubmit();

    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(useUiStore.getState().isAuthEntryActive).toBe(true);
  });

  it("ignores a second submit while the first is pending", async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));
    renderLoginPage();
    await fillAndSubmit();
    const submit = await screen.findByRole("button", { name: "Signing in…" });
    expect(submit).toBeDisabled();
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().isAuthEntryActive).toBe(false);
  });
});
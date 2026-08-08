import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "../LoginPage";
import { useAuthStore } from "@/stores/auth";

const mockLogin = vi.fn();
vi.mock("@/features/auth/services/authService", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

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

describe("LoginPage", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    useAuthStore.getState().clear();
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
    mockLogin.mockResolvedValue({
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
    });

    renderLoginPage();

    await userEvent.type(screen.getByLabelText("Company URL"), "acme");
    await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("Dashboard home")).toBeInTheDocument());
    expect(useAuthStore.getState().accessToken).toBe("access-1");
    expect(useAuthStore.getState().user?.email).toBe("jane@acme.com");
    expect(mockToastSuccess).toHaveBeenCalledWith("Signed in.");
  });

  it("redirects to the originally requested URL after login", async () => {
    mockLogin.mockResolvedValue({
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
    });

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

    await userEvent.type(screen.getByLabelText("Company URL"), "acme");
    await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
    await userEvent.type(screen.getByLabelText("Password"), "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

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
});
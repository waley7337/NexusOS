import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterPage } from "../RegisterPage";
import { useAuthStore } from "@/stores/auth";

const mockRegister = vi.fn();

vi.mock("@/features/auth/services/authService", () => ({
  register: (...args: unknown[]) => mockRegister(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

function renderRegisterPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>Dashboard home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillValidFormExceptPasswords() {
  await userEvent.type(screen.getByLabelText("Company name"), "Acme Inc.");
  await userEvent.type(screen.getByLabelText("First name"), "Jane");
  await userEvent.type(screen.getByLabelText("Last name"), "Doe");
  await userEvent.type(screen.getByLabelText("Work email"), "jane@acme.com");
}

describe("RegisterPage", () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
    useAuthStore.getState().clear();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    renderRegisterPage();
    await fillValidFormExceptPasswords();
    await userEvent.type(screen.getByLabelText("Password"), "Secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "Different123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("registers, stores the session, shows the company URL, and only redirects after confirmation", async () => {
    mockRegister.mockResolvedValue({
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
        companyName: "Acme Inc.",
        companySlug: "acme-inc",
        emailVerified: false,
      },
    });

    renderRegisterPage();
    await fillValidFormExceptPasswords();
    await userEvent.type(screen.getByLabelText("Password"), "Secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "Secret123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    expect(
      await screen.findByText("Save your Company URL"),
    ).toBeInTheDocument();

    expect(screen.getByText("acme-inc")).toBeInTheDocument();

    expect(screen.queryByText("Dashboard home")).not.toBeInTheDocument();

    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Acme Inc.",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@acme.com",
        password: "Secret123",
      }),
    );

    expect(useAuthStore.getState().accessToken).toBe("access-1");
    expect(useAuthStore.getState().user?.companySlug).toBe("acme-inc");

    expect(mockToastSuccess).toHaveBeenCalledWith(
      "Account created. Welcome to NexusOS.",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Continue to dashboard" }),
    );

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
  });

  it("shows an error toast when the email is already taken", async () => {
    const { ApiRequestError } = await import("@/api/client");

    mockRegister.mockRejectedValue(
      new ApiRequestError(
        "An account with this email already exists.",
        [],
      ),
    );

    renderRegisterPage();
    await fillValidFormExceptPasswords();
    await userEvent.type(screen.getByLabelText("Password"), "Secret123");
    await userEvent.type(
      screen.getByLabelText("Confirm password"),
      "Secret123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create account" }),
    );

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        "An account with this email already exists.",
      ),
    );

    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "../ResetPasswordPage";

const mockResetPassword = vi.fn();
vi.mock("@/features/auth/services/authService", () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

function renderPage(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
    mockToastError.mockReset();
    mockToastSuccess.mockReset();
  });

  it("shows an invalid-link state when no token is present", () => {
    renderPage(["/reset-password"]);
    expect(screen.getByText("Invalid reset link")).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling the API", async () => {
    renderPage(["/reset-password?token=abc123"]);
    await userEvent.type(screen.getByLabelText("New password"), "Secret123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Different123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("resets the password and redirects to login on success", async () => {
    mockResetPassword.mockResolvedValue(null);
    renderPage(["/reset-password?token=abc123"]);

    await userEvent.type(screen.getByLabelText("New password"), "Secret123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(screen.getByText("Login page")).toBeInTheDocument());
    expect(mockResetPassword).toHaveBeenCalledWith({ token: "abc123", password: "Secret123" });
    expect(mockToastSuccess).toHaveBeenCalledWith("Password updated. Sign in with your new password.");
  });

  it("shows an error toast when the token is invalid or expired", async () => {
    const { ApiRequestError } = await import("@/api/client");
    mockResetPassword.mockRejectedValue(new ApiRequestError("This link is invalid or has expired.", []));
    renderPage(["/reset-password?token=expired"]);

    await userEvent.type(screen.getByLabelText("New password"), "Secret123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "Secret123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("This link is invalid or has expired."),
    );
  });
});

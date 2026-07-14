import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "../ForgotPasswordPage";

const mockForgotPassword = vi.fn();
vi.mock("@/features/auth/services/authService", () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <ForgotPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mockForgotPassword.mockReset();
  });

  it("shows the same confirmation whether the API call succeeds or fails (enumeration protection)", async () => {
    mockForgotPassword.mockResolvedValue(null);
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText("jane@acme.com")).toBeInTheDocument();
  });

  it("still shows the confirmation screen if the request fails", async () => {
    mockForgotPassword.mockRejectedValue(new Error("network error"));
    renderPage();

    await userEvent.type(screen.getByLabelText("Email"), "jane@acme.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByText("Check your email")).toBeInTheDocument());
  });

  it("does not submit an invalid email", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });
});

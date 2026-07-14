import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailPage } from "../VerifyEmailPage";

const mockVerifyEmail = vi.fn();
vi.mock("@/features/auth/services/authService", () => ({
  verifyEmail: (...args: unknown[]) => mockVerifyEmail(...args),
}));

function renderPage(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <VerifyEmailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    mockVerifyEmail.mockReset();
  });

  it("shows an invalid-link state when no token is present", () => {
    renderPage(["/verify-email"]);
    expect(screen.getByText("Invalid verification link")).toBeInTheDocument();
    expect(mockVerifyEmail).not.toHaveBeenCalled();
  });

  it("auto-submits the token on mount and shows success", async () => {
    mockVerifyEmail.mockResolvedValue(null);
    renderPage(["/verify-email?token=abc123"]);

    expect(screen.getByText("Verifying your email…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Email verified")).toBeInTheDocument());
    expect(mockVerifyEmail).toHaveBeenCalledWith({ token: "abc123" });
  });

  it("shows an error state when the token is invalid or expired", async () => {
    mockVerifyEmail.mockRejectedValue(new Error("invalid token"));
    renderPage(["/verify-email?token=expired"]);

    await waitFor(() =>
      expect(screen.getByText("This link is invalid or has expired")).toBeInTheDocument(),
    );
  });
});

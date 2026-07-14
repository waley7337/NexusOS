import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn().mockResolvedValue({ ok: true }),
}));

import { request } from "@/api/client";
import {
  forgotPassword,
  getMe,
  login,
  logout,
  register,
  resetPassword,
  verifyEmail,
} from "../services/authService";

describe("authService", () => {
  it("login posts to /auth/login with the payload", () => {
    login({ email: "jane@acme.com", password: "secret" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: "/auth/login", data: { email: "jane@acme.com", password: "secret" } }),
    );
  });

  it("register posts to /auth/register with the payload", () => {
    const payload = {
      companyName: "Acme",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.com",
      password: "Secret123",
    };
    register(payload);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: "/auth/register", data: payload }),
    );
  });

  it("logout posts the refresh token to /auth/logout", () => {
    logout("refresh-token-value");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/auth/logout",
        data: { refreshToken: "refresh-token-value" },
      }),
    );
  });

  it("getMe issues a GET to /auth/me", () => {
    getMe();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url: "/auth/me" }));
  });

  it("forgotPassword, resetPassword, and verifyEmail hit the right endpoints", () => {
    forgotPassword({ email: "jane@acme.com" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: "/auth/forgot-password" }),
    );

    resetPassword({ token: "abc", password: "Secret123" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: "/auth/reset-password" }),
    );

    verifyEmail({ token: "abc" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", url: "/auth/verify-email" }),
    );
  });
});

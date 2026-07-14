/** Typed `/auth/*` calls — the only place in this module that knows HTTP. */
import { request } from "@/api/client";
import type {
  AuthSessionDto,
  ForgotPasswordPayload,
  LoginPayload,
  MeDto,
  RegisterPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from "../types";

export function login(payload: LoginPayload, signal?: AbortSignal) {
  return request<AuthSessionDto>({ method: "POST", url: "/auth/login", data: payload, signal });
}

export function register(payload: RegisterPayload, signal?: AbortSignal) {
  return request<AuthSessionDto>({ method: "POST", url: "/auth/register", data: payload, signal });
}

export function logout(refreshToken: string, signal?: AbortSignal) {
  return request<null>({
    method: "POST",
    url: "/auth/logout",
    data: { refreshToken },
    signal,
  });
}

export function getMe(signal?: AbortSignal) {
  return request<MeDto>({ method: "GET", url: "/auth/me", signal });
}

export function forgotPassword(payload: ForgotPasswordPayload, signal?: AbortSignal) {
  return request<null>({ method: "POST", url: "/auth/forgot-password", data: payload, signal });
}

export function resetPassword(payload: ResetPasswordPayload, signal?: AbortSignal) {
  return request<null>({ method: "POST", url: "/auth/reset-password", data: payload, signal });
}

export function verifyEmail(payload: VerifyEmailPayload, signal?: AbortSignal) {
  return request<null>({ method: "POST", url: "/auth/verify-email", data: payload, signal });
}

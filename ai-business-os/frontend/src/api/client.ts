/**
 * Central HTTP client.
 *
 * Responsibilities:
 *  - attach the access token to every request
 *  - transparently refresh on 401 (single-flight: concurrent 401s share one
 *    refresh call), then retry the original request
 *  - unwrap the standard envelope so callers work with `data` directly
 */
import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse } from "@/types/api";

export const api = axios.create({
  baseURL: "/api/v1",
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      "/api/v1/auth/refresh",
      { refreshToken },
    );
    const tokens = res.data.data;
    if (!tokens) throw new Error("No tokens in refresh response");
    setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens.accessToken;
  } catch {
    clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshPromise ??= refreshAccessToken().finally(() => (refreshPromise = null));
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Typed request helper: unwraps the envelope, throws on business failure. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<ApiResponse<T>>(config);
  const body = res.data;
  if (!body.success) {
    throw new ApiRequestError(body.message, body.errors ?? []);
  }
  return body.data as T;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly errors: { code: string; field?: string; detail?: string }[],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

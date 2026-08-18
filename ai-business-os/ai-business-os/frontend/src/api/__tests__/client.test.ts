import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiRequestError, request } from "../client";
import { useAuthStore } from "@/stores/auth";
import type { ApiResponse } from "@/types/api";

const originalAdapter = api.defaults.adapter;

function rejectedResponse(status: number, message: string, errors: ApiResponse<never>["errors"] = []) {
  const adapter: AxiosAdapter = (config) => {
    const response: AxiosResponse = {
      config: config as InternalAxiosRequestConfig,
      data: { success: false, data: null, message, errors },
      headers: {},
      status,
      statusText: String(status),
    };
    return Promise.reject(new AxiosError(message, "ERR_BAD_RESPONSE", config, undefined, response));
  };
  api.defaults.adapter = adapter;
}

describe("shared API client error normalization", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: "access", refreshToken: "refresh", user: null });
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it("normalizes a rejected 422 envelope and preserves structured errors", async () => {
    const errors = [{ code: "validation_error", field: "body.items.0.quantity", detail: "Must be non-negative" }];
    rejectedResponse(422, "Invalid input.", errors);

    await expect(request({ url: "/finance/invoices", method: "POST" })).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Invalid input.",
      status: 422,
      errors,
    });
  });

  it.each([[409, "Invoice changed."], [403, "Not permitted."], [404, "Invoice not found."]])(
    "preserves the public message for HTTP %i",
    async (status, message) => {
      rejectedResponse(status, message);
      await expect(request({ url: "/finance/invoices/i1" })).rejects.toMatchObject({ status, message });
    },
  );

  it("keeps network failures without a response as Axios errors", async () => {
    api.defaults.adapter = (config) => Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));
    const error = await request({ url: "/finance/invoices" }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AxiosError);
    expect(error).not.toBeInstanceOf(ApiRequestError);
  });

  it("retries a 401 with refreshed tokens before normalizing failures", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { success: true, data: { accessToken: "new-access", refreshToken: "new-refresh" }, message: "ok", errors: null } });
    let calls = 0;
    api.defaults.adapter = async (config) => {
      calls += 1;
      if (calls === 1) {
        const response = { config, data: { success: false, data: null, message: "Expired", errors: [] }, headers: {}, status: 401, statusText: "401" };
        throw new AxiosError("Expired", "ERR_BAD_RESPONSE", config, undefined, response);
      }
      return { config, data: { success: true, data: { id: "i1" }, message: "ok", errors: null }, headers: {}, status: 200, statusText: "200" };
    };

    await expect(request<{ id: string }>({ url: "/finance/invoices/i1" })).resolves.toEqual({ id: "i1" });
    expect(calls).toBe(2);
    expect(useAuthStore.getState().accessToken).toBe("new-access");
  });
});

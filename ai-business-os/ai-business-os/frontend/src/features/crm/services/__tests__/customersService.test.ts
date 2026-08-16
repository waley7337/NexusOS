import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }),
}));

import { request } from "@/api/client";
import {
  archiveCustomer,
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../customersService";

describe("customersService", () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  it("lists customers with camelCase query params", async () => {
    await listCustomers({
      page: 2,
      pageSize: 10,
      search: "acme",
      status: "active",
      sortBy: "company_name",
      sortDesc: false,
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/crm/customers",
        params: {
          page: 2,
          pageSize: 10,
          search: "acme",
          status: "active",
          sortBy: "company_name",
          sortDesc: false,
        },
      }),
    );
  });

  it("gets a customer by id", async () => {
    await getCustomer("cust-1");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/crm/customers/cust-1",
      }),
    );
  });

  it("creates a customer without system fields", async () => {
    const payload = {
      companyName: "Acme",
      status: "lead" as const,
      email: "a@example.com",
    };
    await createCustomer(payload);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/crm/customers",
        data: payload,
      }),
    );
    const data = vi.mocked(request).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("companyId");
    expect(data).not.toHaveProperty("createdBy");
    expect(data).not.toHaveProperty("id");
  });

  it("updates a customer via PATCH", async () => {
    await updateCustomer("cust-1", { companyName: "Acme Ltd" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: "/crm/customers/cust-1",
        data: { companyName: "Acme Ltd" },
      }),
    );
  });

  it("archives a customer via DELETE", async () => {
    await archiveCustomer("cust-1");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: "/crm/customers/cust-1",
      }),
    );
  });
});

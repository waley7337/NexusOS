import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  }),
}));

import { request } from "@/api/client";
import {
  archiveContact,
  createContact,
  getContact,
  listContacts,
  updateContact,
} from "../contactsService";

describe("contactsService", () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  it("lists contacts with camelCase query params", async () => {
    await listContacts({
      page: 2,
      pageSize: 10,
      search: "ada",
      customerId: "cust-1",
      sortBy: "last_name",
      sortDesc: false,
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/crm/contacts",
        params: {
          page: 2,
          pageSize: 10,
          search: "ada",
          customerId: "cust-1",
          sortBy: "last_name",
          sortDesc: false,
        },
      }),
    );
  });

  it("gets a contact by id", async () => {
    await getContact("c1");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", url: "/crm/contacts/c1" }),
    );
  });

  it("creates without system fields", async () => {
    const payload = {
      customerId: "cust-1",
      firstName: "Ada",
      lastName: "Lovelace",
    };
    await createContact(payload);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/crm/contacts",
        data: payload,
      }),
    );
    const data = vi.mocked(request).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("companyId");
    expect(data).not.toHaveProperty("id");
  });

  it("updates via PATCH", async () => {
    await updateContact("c1", { firstName: "Augusta" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: "/crm/contacts/c1",
        data: { firstName: "Augusta" },
      }),
    );
  });

  it("archives via DELETE", async () => {
    await archiveContact("c1");
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: "DELETE", url: "/crm/contacts/c1" }),
    );
  });
});

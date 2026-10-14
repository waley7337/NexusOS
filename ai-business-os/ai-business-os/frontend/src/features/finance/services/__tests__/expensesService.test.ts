import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  request: vi.fn(),
}));

import { request } from "@/api/client";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from "../expensesService";

const mockedRequest = vi.mocked(request);

describe("expensesService", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("lists expenses with query params", async () => {
    mockedRequest.mockResolvedValueOnce({ items: [], meta: {} });
    await listExpenses({ page: 1, category: "Travel" });
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/finance/expenses",
        params: { page: 1, category: "Travel" },
      }),
    );
  });

  it("creates, reads, updates, and deletes expenses", async () => {
    mockedRequest
      .mockResolvedValueOnce({ id: "e1" })
      .mockResolvedValueOnce({ id: "e1" })
      .mockResolvedValueOnce({ id: "e1", category: "Meals" })
      .mockResolvedValueOnce(null);

    await createExpense({
      category: "Travel",
      amount: "10.00",
      currency: "USD",
      date: "2026-10-01",
    });
    await getExpense("e1");
    await updateExpense("e1", { category: "Meals" });
    await deleteExpense("e1");

    expect(mockedRequest).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ method: "POST", url: "/finance/expenses" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ method: "GET", url: "/finance/expenses/e1" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ method: "PATCH", url: "/finance/expenses/e1" }),
    );
    expect(mockedRequest).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ method: "DELETE", url: "/finance/expenses/e1" }),
    );
  });
});

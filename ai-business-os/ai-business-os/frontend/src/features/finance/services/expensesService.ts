import { request } from "@/api/client";
import type { Paginated } from "@/types/api";
import type {
  Expense,
  ExpenseListParams,
  ExpensePayload,
  ExpenseUpdatePayload,
} from "../types";

const BASE = "/finance/expenses";

export function listExpenses(
  params: ExpenseListParams,
  signal?: AbortSignal,
): Promise<Paginated<Expense>> {
  return request({ method: "GET", url: BASE, params, signal });
}

export function getExpense(id: string, signal?: AbortSignal): Promise<Expense> {
  return request({ method: "GET", url: `${BASE}/${id}`, signal });
}

export function createExpense(payload: ExpensePayload): Promise<Expense> {
  return request({ method: "POST", url: BASE, data: payload });
}

export function updateExpense(
  id: string,
  payload: ExpenseUpdatePayload,
): Promise<Expense> {
  return request({ method: "PATCH", url: `${BASE}/${id}`, data: payload });
}

export async function deleteExpense(id: string): Promise<void> {
  await request<null>({ method: "DELETE", url: `${BASE}/${id}` });
}

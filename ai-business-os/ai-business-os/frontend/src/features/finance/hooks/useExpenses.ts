import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import * as service from "../services/expensesService";
import type {
  Expense,
  ExpenseListParams,
  ExpensePayload,
  ExpenseUpdatePayload,
} from "../types";

export function useExpenses(params: ExpenseListParams) {
  return useQuery({
    queryKey: queryKeys.finance.expenses.list(params as Record<string, unknown>),
    queryFn: ({ signal }) => service.listExpenses(params, signal),
  });
}

export function useExpense(id?: string) {
  return useQuery({
    queryKey: queryKeys.finance.expenses.detail(id ?? ""),
    queryFn: ({ signal }) => service.getExpense(id!, signal),
    enabled: Boolean(id),
  });
}

function useExpenseMutation<T>(mutationFn: (arg: T) => Promise<Expense>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (expense) => {
      client.setQueryData(queryKeys.finance.expenses.detail(expense.id), expense);
      void client.invalidateQueries({ queryKey: queryKeys.finance.expenses.lists() });
    },
  });
}

export function useCreateExpense() {
  return useExpenseMutation<ExpensePayload>(service.createExpense);
}

export function useUpdateExpense() {
  return useExpenseMutation<{ id: string; payload: ExpenseUpdatePayload }>(
    ({ id, payload }) => service.updateExpense(id, payload),
  );
}

export function useDeleteExpense() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: service.deleteExpense,
    onSuccess: (_value, id) => {
      client.removeQueries({ queryKey: queryKeys.finance.expenses.detail(id) });
      void client.invalidateQueries({ queryKey: queryKeys.finance.expenses.lists() });
    },
  });
}

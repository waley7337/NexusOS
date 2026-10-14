import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/usePermission";
import type { Expense } from "../types";

export function ExpensesTable({
  expenses,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}) {
  const canUpdate = usePermission("expenses.update");
  const canDelete = usePermission("expenses.delete");

  return (
    <div className="overflow-x-auto rounded-card border border-line-soft bg-surface-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft bg-surface-3/80 text-left text-2xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3 text-right">Amount</th>
            {(canUpdate || canDelete) && (
              <th className="px-4 py-3 text-right">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              className="border-b border-line-soft last:border-0 hover:bg-surface-3"
            >
              <td className="px-4 py-3 tabular-nums">{expense.date}</td>
              <td className="px-4 py-3 font-medium">{expense.category}</td>
              <td className="max-w-[28ch] truncate px-4 py-3 text-muted-foreground">
                {expense.description ?? "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {expense.currency} {expense.amount}
              </td>
              {(canUpdate || canDelete) && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canUpdate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit expense ${expense.category}`}
                        onClick={() => onEdit(expense)}
                      >
                        <Pencil />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete expense ${expense.category}`}
                        onClick={() => onDelete(expense)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

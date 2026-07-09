/**
 * DataTable — §4.12. The standard table for every module list screen.
 *
 * Supports: sorting, global search, pagination, bulk row selection,
 * column visibility, CSV export, responsive overflow, empty state.
 *
 * Usage:
 *   const columns: ColumnDef<Customer>[] = [ ... ];
 *   <DataTable columns={columns} data={customers} searchPlaceholder="Search customers…" />
 *
 * A11y: real <table> semantics; sortable headers are buttons announcing
 * aria-sort; selection checkboxes have accessible names.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Download, Inbox, Search } from "lucide-react";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Pagination } from "./pagination";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  /** Enables the bulk-selection column. */
  selectable?: boolean;
  /** Renders when there are no rows at all (before filtering). */
  emptyState?: ReactNode;
  /** File name for CSV export; export button hidden when omitted. */
  exportFileName?: string;
  pageSize?: number;
  onSelectionChange?: (rows: TData[]) => void;
}

export function DataTable<TData>({
  columns: userColumns,
  data,
  searchPlaceholder = "Search…",
  selectable = false,
  emptyState,
  exportFileName,
  pageSize = 10,
  onSelectionChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);

  const columns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!selectable) return userColumns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
        />
      ),
    };
    return [selectColumn, ...userColumns];
  }, [selectable, userColumns]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, rowSelection, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: (updater) => {
      setRowSelection((old) => {
        const next = typeof updater === "function" ? updater(old) : updater;
        return next;
      });
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  // Notify parent of selection (after state settles)
  useMemo(() => {
    onSelectionChange?.(table.getSelectedRowModel().rows.map((r) => r.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const exportCsv = () => {
    const visible = table
      .getAllLeafColumns()
      .filter((c) => c.getIsVisible() && c.id !== "select");
    const header = visible.map((c) => JSON.stringify(String(c.columnDef.header ?? c.id)));
    const rows = table.getFilteredRowModel().rows.map((row) =>
      visible.map((col) => JSON.stringify(String(row.getValue(col.id) ?? ""))).join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFileName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.length === 0 && emptyState) return <>{emptyState}</>;

  const selectedCount = table.getSelectedRowModel().rows.length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-8"
          />
        </div>
        {selectedCount > 0 && (
          <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {exportFileName && (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download /> Export
            </Button>
          )}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              aria-expanded={columnsMenuOpen}
              aria-haspopup="menu"
              onClick={() => setColumnsMenuOpen((v) => !v)}
            >
              <Columns3 /> Columns
            </Button>
            {columnsMenuOpen && (
              <>
                <div className="fixed inset-0 z-dropdown" aria-hidden onClick={() => setColumnsMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 z-dropdown mt-1 w-44 rounded-card border bg-card p-1.5 shadow-dropdown"
                >
                  {table
                    .getAllLeafColumns()
                    .filter((c) => c.getCanHide())
                    .map((col) => (
                      <label
                        key={col.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60"
                      >
                        <Checkbox
                          checked={col.getIsVisible()}
                          onCheckedChange={(v) => col.toggleVisibility(Boolean(v))}
                        />
                        {String(col.columnDef.header ?? col.id)}
                      </label>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border bg-card">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/50">
                {hg.headers.map((header) => {
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : undefined}
                      className="px-4 py-2.5 text-left font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="inline-flex items-center gap-1.5 rounded transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : sortDir === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  <Inbox className="mx-auto mb-2 h-5 w-5" aria-hidden />
                  Nothing matches your search.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    "border-b transition-colors duration-fast last:border-0 hover:bg-secondary/40",
                    row.getIsSelected() && "bg-primary/5",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {data.length} rows
        </p>
        <Pagination
          page={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          onPageChange={(p) => table.setPageIndex(p - 1)}
        />
      </div>
    </div>
  );
}

/** Pagination — table footer control. Windowed page numbers with ellipses. */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;        // 1-based
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Windowed page list: 1 … 4 5 [6] 7 8 … 20 */
export function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon" aria-label="Previous page" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft />
      </Button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "secondary" : "ghost"}
            size="sm"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button variant="ghost" size="icon" aria-label="Next page" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight />
      </Button>
    </nav>
  );
}

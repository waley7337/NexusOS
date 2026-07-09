/** Breadcrumb — "Where am I?" for nested pages. Last item is the current page. */
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
            {last || !item.to ? (
              <span aria-current={last ? "page" : undefined} className={cn(last ? "font-medium" : "text-muted-foreground")}>
                {item.label}
              </span>
            ) : (
              <Link to={item.to} className="text-muted-foreground transition-colors duration-fast hover:text-foreground">
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "@/constants/routes";
import { prefetchRoute } from "@/routes/prefetch";
import { useUiStore } from "@/stores/ui";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

interface AppNavigationProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

// Part 04, Phase 5 — sidebar grouping. Split once at module scope; NAV_ITEMS
// doesn't change at runtime.
const PRIMARY_ITEMS = NAV_ITEMS.filter((item) => item.group !== "more");
const MORE_ITEMS = NAV_ITEMS.filter((item) => item.group === "more");

function NavLinkItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { to, label, icon: Icon, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          // Glow-tinted active state (Part 04, Phase 5) — Design Constitution
          // principle 15: color communicates state, restrained everywhere else.
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && label}
    </NavLink>
  );
}

function NavItems({ collapsed = false, onNavigate }: AppNavigationProps) {
  // Session-only, local to this render tree — same precedent as
  // isSidebarCollapsed in stores/ui.ts (no persistence).
  const [moreOpen, setMoreOpen] = useState(false);

  // Icon-only sidebar has no room for a disclosure header — render everything
  // flat rather than hiding "more" items behind a collapsed toggle nobody can see.
  if (collapsed) {
    return (
      <>
        {NAV_ITEMS.map((item) => (
          <NavLinkItem key={item.to} item={item} collapsed onNavigate={onNavigate} />
        ))}
      </>
    );
  }

  return (
    <>
      {PRIMARY_ITEMS.map((item) => (
        <NavLinkItem key={item.to} item={item} collapsed={false} onNavigate={onNavigate} />
      ))}

      {MORE_ITEMS.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !moreOpen && "-rotate-90")} />
            <span className="flex-1 text-left">More modules</span>
            <Badge>{MORE_ITEMS.length}</Badge>
          </button>

          {moreOpen && (
            <div className="mt-0.5 space-y-0.5">
              {MORE_ITEMS.map((item) => (
                <NavLinkItem key={item.to} item={item} collapsed={false} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Desktop sidebar navigation links. */
export function AppNavigation({ collapsed = false }: AppNavigationProps) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      <NavItems collapsed={collapsed} />
    </nav>
  );
}

/** Mobile drawer navigation — sheet behind hamburger (§5.17). */
export function MobileSidebar() {
  const open = useUiStore((s) => s.isMobileSidebarOpen);
  const setOpen = useUiStore((s) => s.setMobileSidebarOpen);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent side="left" className="max-w-[15rem] border-r p-0">
        <DrawerHeader title="NexusOS" />
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          <NavItems onNavigate={() => setOpen(false)} />
        </nav>
      </DrawerContent>
    </Drawer>
  );
}

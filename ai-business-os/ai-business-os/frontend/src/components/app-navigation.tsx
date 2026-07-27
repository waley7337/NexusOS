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
          "focus-ring group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-fast",
          collapsed && "justify-center px-0",
          // Neutral raised fill, not a colour wash (Part 04 convergence,
          // Commit C). The active row previously used bg-primary/10 +
          // text-primary, which put the brand colour on the single most
          // persistent element on screen and was a large part of why the
          // accent read as a page-wide cast. Elevation now says "you are
          // here"; the accent survives only on the icon and the trailing dot,
          // where it marks position without tinting the label.
          isActive
            ? "bg-surface-3 font-medium text-foreground"
            : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-fast",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {!collapsed && isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </>
      )}
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
            className="focus-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors duration-fast hover:bg-surface-3 hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-fast", !moreOpen && "-rotate-90")} />
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

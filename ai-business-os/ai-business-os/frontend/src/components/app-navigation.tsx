import { useState } from "react";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { transitionSpatial, transitionStandard } from "@/lib/motion";
import { NAV_ITEMS, type NavItem } from "@/constants/routes";
import { prefetchRoute } from "@/routes/prefetch";
import { useUiStore } from "@/stores/ui";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/ui/tooltip";

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
  const prefersReducedMotion = useReducedMotion();
  const collapseTransition = prefersReducedMotion ? { duration: 0 } : transitionSpatial;
  const indicatorTransition = prefersReducedMotion ? { duration: 0 } : transitionStandard;

  const link = (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRoute(to)}
      onFocus={() => prefetchRoute(to)}
      className={({ isActive }) =>
        cn(
          "focus-ring group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm transition-colors duration-fast",
          isActive ? "font-medium text-foreground" : "text-muted-foreground hover:bg-surface-3 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            // Shared layoutId: route changes FLIP this fill from the old row
            // to the new one instead of popping it. -z-10 is load-bearing —
            // an absolutely-positioned child with z-index:auto still paints
            // above in-flow content, which would cover the icon and label.
            <motion.span
              layoutId="nav-active-surface"
              className="absolute inset-0 -z-10 rounded-lg bg-surface-3 shadow-inset"
              transition={indicatorTransition}
              aria-hidden="true"
            />
          )}
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-fast",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          {/* Not flex-1: flex-basis:0 would out-rank the animated inline
              width Framer Motion sets. Sized by content instead. */}
          <motion.span
            animate={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
            transition={collapseTransition}
            className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap"
          >
            <span className="min-w-0 truncate">{label}</span>
            {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          </motion.span>
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <IconTooltip label={label} side="right">
      {link}
    </IconTooltip>
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
        // V3: a rule separates the groups, not just spacing. The primary
        // modules and the rest were previously distinguished only by a gap,
        // which reads as a list that happens to have a button in it rather
        // than as two groups. The hairline is --line-soft, deliberately
        // weaker than the chassis rail: this is a division inside a region,
        // not a structural boundary.
        <div className="mt-2 border-t border-line-soft pt-2">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="focus-ring text-machine flex w-full items-center gap-2 rounded-control px-3 py-2 transition-colors duration-fast hover:bg-surface-3 hover:text-foreground"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-fast", !moreOpen && "-rotate-90")} />
            <span className="flex-1 text-left">More modules</span>
            <span className="num tabular-nums">{MORE_ITEMS.length}</span>
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
    <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-3">
      {/* Scoped so this list's layoutId cannot cross-match the mobile
          drawer. The desktop aside is only CSS-hidden below md, not
          unmounted, so both trees exist whenever the drawer is open. */}
      <LayoutGroup id="sidebar-nav">
        <NavItems collapsed={collapsed} />
      </LayoutGroup>
    </nav>
  );
}

/** Mobile drawer navigation — sheet behind hamburger (§5.17). */
export function MobileSidebar({
  chrome,
}: {
  chrome?: {
    userName: string;
    companyName: string;
    userInitial: string;
    onAccount: () => void;
    onNotifications: () => void;
    onLogout: () => void;
    logoutPending?: boolean;
  };
}) {
  const open = useUiStore((s) => s.isMobileSidebarOpen);
  const setOpen = useUiStore((s) => s.setMobileSidebarOpen);

  const closeThen = (fn: () => void) => {
    setOpen(false);
    window.setTimeout(fn, 0);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent side="left" className="max-w-[15rem] border-r p-0">
        <DrawerHeader title="NexusOS" />
        <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-3">
          <LayoutGroup id="mobile-nav">
            <NavItems onNavigate={() => setOpen(false)} />
          </LayoutGroup>
        </nav>
        {chrome && (
          <div className="mt-auto shrink-0 border-t border-line-soft p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => closeThen(chrome.onAccount)}
                aria-label="Open account"
                className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-xs font-semibold"
                  aria-hidden="true"
                >
                  {chrome.userInitial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{chrome.userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{chrome.companyName}</p>
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="shrink-0"
                onClick={() => closeThen(chrome.onNotifications)}
              >
                <Bell />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={chrome.logoutPending ? "Logging out" : "Log out"}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                disabled={chrome.logoutPending}
                onClick={() => closeThen(chrome.onLogout)}
              >
                <LogOut />
              </Button>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/**
 * NexusOS shell — implements the Part 2 navigation wireframe:
 *   sidebar (collapsible) · top bar with global search · content · profile footer.
 * Every page inside answers: Where am I? (sidebar) What can I do? (page header)
 * What next? (primary action).
 */
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare, UserRound, Wallet,
  Boxes, FileText, BarChart3, Sparkles, Settings, Search, Bell,
  PanelLeftClose, PanelLeftOpen, Moon, Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/providers/theme-provider";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/crm", label: "CRM", icon: Users },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/hr", label: "HR", icon: UserRound },
  { to: "/finance", label: "Finance", icon: Wallet },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  const openPalette = () =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));

  return (
    <div className="flex min-h-screen">
      <CommandPalette />

      {/* ---------- Sidebar ---------- */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center border-b", collapsed ? "justify-center" : "gap-2 px-5")}>
          <div className="h-6 w-6 shrink-0 rounded-md bg-primary" />
          {!collapsed && <span className="truncate text-sm font-semibold tracking-tight">NexusOS</span>}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Profile / notifications footer (wireframe bottom row) */}
        <div className={cn("border-t p-3", collapsed && "flex justify-center")}>
          <div className={cn("flex items-center gap-3", collapsed && "flex-col gap-2")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {(user?.name ?? "G").slice(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name ?? "Guest"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.companyName ?? "No company"}</p>
              </div>
            )}
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative shrink-0">
              <Bell />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>

          <button
            onClick={openPalette}
            className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 md:max-w-md"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search anything…</span>
            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

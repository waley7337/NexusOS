/**
 * NexusOS shell — implements the Part 2 navigation wireframe:
 *   sidebar (collapsible) · top bar with global search · content · profile footer.
 */
import {
  Search,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
  Menu,
  LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/providers/theme-provider";
import { useUiStore } from "@/stores/ui";
import { useRouteFocus } from "@/hooks/useRouteFocus";
import { useLogout } from "@/features/auth";
import { ROUTES } from "@/constants/routes";
import { CommandPalette } from "@/components/command-palette";
import {
  AppNavigation,
  MobileSidebar,
} from "@/components/app-navigation";
import { OfflineBanner } from "@/components/offline-banner";
import { LazyOutlet } from "@/routes/LazyOutlet";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();

  const { theme, setTheme } = useTheme();

  const collapsed = useUiStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleCollapsed = useUiStore(
    (state) => state.toggleSidebarCollapsed,
  );
  const toggleMobileSidebar = useUiStore(
    (state) => state.toggleMobileSidebar,
  );
  const toggleCommandPalette = useUiStore(
    (state) => state.toggleCommandPalette,
  );

  useRouteFocus();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate(ROUTES.login, { replace: true });
  };

  const userInitial = (user?.name ?? "G")
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <MobileSidebar />

      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center border-b",
            collapsed ? "justify-center" : "gap-2 px-5",
          )}
        >
          <div className="h-6 w-6 shrink-0 rounded-md bg-primary" />

          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">
              NexusOS
            </span>
          )}
        </div>

        <AppNavigation collapsed={collapsed} />

        <div
          className={cn(
            "mt-auto border-t p-3",
            collapsed && "flex justify-center",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "flex-col gap-2",
            )}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold"
              aria-hidden="true"
            >
              {userInitial}
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user?.name ?? "Guest"}
                </p>

                <p className="truncate text-xs text-muted-foreground">
                  {user?.companyName ?? "No company"}
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              title="Notifications"
              className="relative shrink-0"
            >
              <Bell />

              <span
                className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                logoutMutation.isPending
                  ? "Logging out"
                  : "Log out"
              }
              title="Log out"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={logoutMutation.isPending}
              onClick={handleLogout}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation menu"
            onClick={toggleMobileSidebar}
          >
            <Menu />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            aria-label={
              collapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen />
            ) : (
              <PanelLeftClose />
            )}
          </Button>

          <button
            type="button"
            onClick={toggleCommandPalette}
            className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 md:max-w-md"
          >
            <Search className="h-4 w-4" />

            <span className="flex-1 text-left">
              Search anything…
            </span>

            <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() =>
                setTheme(
                  theme === "dark" ? "light" : "dark",
                )
              }
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>

        <OfflineBanner />

        <main
          className="flex-1 p-6 md:p-8"
          tabIndex={-1}
        >
          <LazyOutlet />
        </main>
      </div>
    </div>
  );
}
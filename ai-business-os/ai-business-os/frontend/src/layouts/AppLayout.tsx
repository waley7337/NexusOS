/**
 * NexusOS shell — implements the Part 2 navigation wireframe:
 *   sidebar (collapsible) · top bar with global search · content · profile footer.
 */
import {
  Search,
  Bell,
  Plus,
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
import { useLiveClock } from "@/hooks/useLiveClock";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { useCaptureActions } from "@/hooks/useCaptureActions";
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
import { ShellStatusBar } from "@/components/ui/shell-status-bar";
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";

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
  const notificationPanelOpen = useUiStore(
    (state) => state.isNotificationPanelOpen,
  );
  const setNotificationPanelOpen = useUiStore(
    (state) => state.setNotificationPanelOpen,
  );
  const toggleNotificationPanel = useUiStore(
    (state) => state.toggleNotificationPanel,
  );
  // Store, not local state (Part 04, Phase 7): DashboardPage's hero also
  // has a Capture trigger and needs to open this same sheet — a sibling
  // route component can't reach AppLayout's local state, so this moved to
  // the store, same shape as isNotificationPanelOpen above.
  const captureOpen = useUiStore((state) => state.isCaptureOpen);
  const setCaptureOpen = useUiStore((state) => state.setCaptureOpen);

  useRouteFocus();

  // Both feed ShellStatusBar, which now owns the "Synced N ago" formatting.
  const systemStatus = useSystemStatus();
  const clock = useLiveClock();

  const captureActions = useCaptureActions();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate(ROUTES.login, { replace: true });
  };

  const userInitial = (user?.name ?? "G")
    .slice(0, 1)
    .toUpperCase();

  return (
    // h-dvh + overflow-hidden makes the shell a fixed frame with its own
    // internal scroll (Part 04 convergence, Commit C). This is what lets the
    // status bar sit permanently at the foot of the shell instead of scrolling
    // away with the document. dvh rather than vh so mobile browser chrome
    // collapsing doesn't leave the bar off-screen.
    <div className="flex h-dvh overflow-hidden">
      <CommandPalette />
      <MobileSidebar />

      <Drawer open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen}>
        <DrawerContent>
          <DrawerHeader title="Notifications" />
          <DrawerBody>
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              description="You'll see mentions, overdue items, and updates from your team here."
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent>
          <DialogHeader title="Capture" description="Quick-create actions from anywhere in NexusOS." />
          {captureActions.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No quick actions yet"
              description="Modules register their create actions here as they ship."
            />
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {captureActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    setCaptureOpen(false);
                    action.onSelect();
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60"
                >
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* surface-1 (one step below the card level) + blur: the sidebar now
          reads as chrome sitting behind the content rather than as another
          card. Previously it was bg-card, byte-identical to every panel. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r bg-surface-1/95 backdrop-blur-xl transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-[270px]",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center",
            collapsed ? "justify-center" : "gap-2.5 px-4",
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-fill">
            <span className="font-mono text-xs font-bold text-white">N</span>
          </div>

          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold tracking-tight">NexusOS</div>
              <div className="truncate text-2xs text-muted-foreground">Business Operating System</div>
            </div>
          )}
        </div>

        <AppNavigation collapsed={collapsed} />

        {/* The system status that used to live here has moved to the shell's
            bottom bar (ShellStatusBar) — deliberately rendered in exactly one
            place, so the two can never disagree. */}
        <div
          className={cn(
            "mt-auto shrink-0 border-t p-3",
            collapsed && "flex flex-col items-center",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "flex-col gap-2",
            )}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-xs font-semibold"
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
                {user?.companySlug && (
                  <p className="truncate font-mono text-2xs text-muted-foreground" title={`Company URL: ${user.companySlug}`}>
                    Company URL: {user.companySlug}
                  </p>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              title="Notifications"
              className="relative shrink-0"
              onClick={toggleNotificationPanel}
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-surface-1/80 px-4 backdrop-blur-xl md:px-6">
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
            className="focus-ring flex h-9 flex-1 items-center gap-2 rounded-lg border bg-surface-2 px-3 text-sm text-muted-foreground transition-colors duration-fast hover:border-line-strong hover:text-foreground md:max-w-md"
          >
            <Search className="h-4 w-4 shrink-0" />

            <span className="flex-1 text-left">
              Search anything…
            </span>

            <span className="ml-2 hidden items-center gap-0.5 sm:flex">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>

          <Button type="button" size="sm" onClick={() => setCaptureOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">Capture</span>
          </Button>

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

        {/* Content is capped and centred (Commit B), and owns the shell's
            scroll (Commit C) so the status bar below stays put.
            focus:outline-none suppresses the platform ring that
            useRouteFocus's fallback would otherwise paint around the whole
            content region — see the note in that hook. tabIndex={-1} means
            this is not Tab-reachable, so no keyboard affordance is lost. */}
        <main className="flex-1 overflow-y-auto focus:outline-none" tabIndex={-1}>
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <LazyOutlet />
          </div>
        </main>

        <ShellStatusBar
          variant={systemStatus.variant}
          label={systemStatus.label}
          lastSyncedAt={systemStatus.lastSyncedAt}
          now={clock}
          onCommandPalette={toggleCommandPalette}
        />
      </div>
    </div>
  );
}
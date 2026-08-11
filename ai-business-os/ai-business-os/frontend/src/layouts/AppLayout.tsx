/**
 * NexusOS shell — implements the Part 2 navigation wireframe:
 *   sidebar (collapsible) · top bar with global search · content · profile footer.
 */
import { useState } from "react";
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
  Copy,
  Check,
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

  const [accountOpen, setAccountOpen] = useState(false);
  const [companySlugCopied, setCompanySlugCopied] = useState(false);

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

  const handleCopyCompanySlug = async () => {
    if (!user?.companySlug) return;

    try {
      await navigator.clipboard.writeText(user.companySlug);
      setCompanySlugCopied(true);

      window.setTimeout(() => {
        setCompanySlugCopied(false);
      }, 2000);
    } catch {
      setCompanySlugCopied(false);
    }
  };

  const handleAccountOpenChange = (open: boolean) => {
    setAccountOpen(open);

    if (!open) {
      setCompanySlugCopied(false);
    }
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

      <Dialog open={accountOpen} onOpenChange={handleAccountOpenChange}>
        <DialogContent>
          <DialogHeader
            title="Account"
            description="Your personal and company information."
          />

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-4 text-sm font-semibold"
                aria-hidden="true"
              >
                {userInitial}
              </div>

              <div className="min-w-0">
                <p className="truncate text-base font-semibold">
                  {user?.name ?? "Guest"}
                </p>
                <p className="truncate text-sm capitalize text-muted-foreground">
                  {user?.role ?? "No role"}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Personal information
              </h3>

              <div className="divide-y rounded-lg border bg-surface-1">
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Name
                  </span>
                  <span className="min-w-0 break-words text-sm font-medium">
                    {user?.name ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Email
                  </span>
                  <span className="min-w-0 break-all text-sm font-medium">
                    {user?.email ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Email status
                  </span>
                  <span className="text-sm font-medium">
                    {user?.emailVerified ? "Verified" : "Not verified"}
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company
              </h3>

              <div className="divide-y rounded-lg border bg-surface-1">
                <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Company
                  </span>
                  <span className="min-w-0 break-words text-sm font-medium">
                    {user?.companyName ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Company URL
                  </span>

                  <code className="min-w-0 break-all text-sm text-foreground">
                    {user?.companySlug ?? "—"}
                  </code>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!user?.companySlug}
                    onClick={() => void handleCopyCompanySlug()}
                    aria-label="Copy Company URL"
                  >
                    {companySlugCopied ? <Check /> : <Copy />}
                    {companySlugCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Use this Company URL together with your email and password
                when signing in to NexusOS.
              </p>
            </section>
          </div>
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
            "nexusos-brand flex h-14 shrink-0 items-center",
            collapsed ? "justify-center" : "gap-2.5 px-4",
          )}
        >
          {collapsed ? (
            <div
              className="nexusos-brand-mark h-8 w-8"
              aria-label="NexusOS"
            >
              <img
                src="/nexusos-logo.png"
                alt=""
                width={32}
                height={32}
                draggable={false}
              />
            </div>
          ) : (
            <div className="nexusos-brand-copy min-w-0 leading-tight">
              <div className="nexusos-wordmark-lockup">
                <img
                  className="nexusos-wordmark-img"
                  src="/nexusos-wordmark.png"
                  alt="NexusOS"
                  width={168}
                  height={27}
                  draggable={false}
                />
              </div>
              <div className="truncate text-2xs text-muted-foreground">
                Business Operating System
              </div>
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
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label="Open account"
              title="Account"
              className={cn(
                "focus-ring flex min-w-0 items-center rounded-lg text-left transition-colors hover:bg-secondary/60",
                collapsed
                  ? "h-9 w-9 justify-center"
                  : "flex-1 gap-3 px-2 py-1.5",
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
                </div>
              )}
            </button>

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
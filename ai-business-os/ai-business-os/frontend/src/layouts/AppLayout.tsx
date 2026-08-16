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
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { transitionSpatial } from "@/lib/motion";
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
import { IconTooltip, TooltipProvider } from "@/components/ui/tooltip";
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

  const prefersReducedMotion = useReducedMotion();
  // Same reasoning as app-navigation — Framer Motion bypasses the CSS
  // reduced-motion backstop, so the brand crossfade and footer identity
  // block need their own opt-out. Spatial band: this motion travels with
  // the sidebar rail, not with a hover.
  const shellCollapseTransition = prefersReducedMotion ? { duration: 0 } : transitionSpatial;

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
    <TooltipProvider delayDuration={150} skipDelayDuration={200}>
    <div className="flex h-dvh overflow-hidden bg-background">
      <CommandPalette />
      <MobileSidebar
        chrome={{
          userName: user?.name ?? "Guest",
          companyName: user?.companyName ?? "No company",
          userInitial,
          onAccount: () => setAccountOpen(true),
          onNotifications: () => setNotificationPanelOpen(true),
          onLogout: () => void handleLogout(),
          logoutPending: logoutMutation.isPending,
        }}
      />

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
          <DialogHeader
            title="Capture"
            description="Jump to a page or switch theme. Create actions appear here when modules ship."
          />
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
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-4 hover:text-foreground focus-ring"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-4 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                    <action.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1 truncate">{action.label}</span>
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
            description="Signed-in identity for this workspace. Nothing here can be edited yet."
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
              <h3 className="text-caption">Personal information</h3>

              <div className="divide-y divide-line-soft rounded-card border border-line-soft bg-surface-1">
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
                  <span className="text-sm text-muted-foreground">
                    Name
                  </span>
                  <span className="min-w-0 break-words text-sm font-medium">
                    {user?.name ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
                  <span className="text-sm text-muted-foreground">
                    Email
                  </span>
                  <span className="min-w-0 break-all text-sm font-medium">
                    {user?.email ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
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
              <h3 className="text-caption">Company</h3>

              <div className="divide-y divide-line-soft rounded-card border border-line-soft bg-surface-1">
                <div className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
                  <span className="text-sm text-muted-foreground">
                    Company
                  </span>
                  <span className="min-w-0 break-words text-sm font-medium">
                    {user?.companyName ?? "—"}
                  </span>
                </div>

                <div className="grid grid-cols-1 items-start gap-2 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
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
          "hidden min-w-0 shrink-0 flex-col overflow-hidden border-r border-line-soft bg-surface-1/95 backdrop-blur-xl transition-[width] duration-spatial ease-in-out-quint md:flex",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        {/* Fixed height in both states (previously h-14 vs h-[4.75rem]) so
            the mark/wordmark swap is a pure crossfade — no simultaneous
            height jump to desync from the width transition. Both marks stay
            mounted and share the same left inset; only opacity moves. */}
        <div className="nexusos-brand relative h-[4.75rem] shrink-0 px-4">
          {/* Opacity is inverse of the wordmark: the wordmark PNG already
              contains this glyph, so leaving the mark at opacity 1 while
              expanded rendered the logo twice. left-4 centres the 32px
              mark in the 64px collapsed rail (16+32+16) without moving
              it on expand — same optical-anchor rule as the nav icons. */}
          <motion.div
            animate={{ opacity: collapsed ? 1 : 0 }}
            transition={shellCollapseTransition}
            className="nexusos-brand-mark absolute left-4 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-hidden={!collapsed}
          >
            <img
              src="/nexusos-logo.png"
              alt={collapsed ? "NexusOS" : ""}
              width={32}
              height={32}
              draggable={false}
            />
          </motion.div>

          <motion.div
            animate={{ opacity: collapsed ? 0 : 1 }}
            transition={shellCollapseTransition}
            className="nexusos-brand-copy absolute left-14 top-1/2 min-w-0 -translate-y-1/2 overflow-hidden leading-tight"
            aria-hidden={collapsed}
          >
            <div className="nexusos-wordmark-lockup">
              <img
                className="nexusos-wordmark-img"
                src={
                  theme === "dark"
                    ? "/nexusos-wordmark.png"
                    : "/nexusos-wordmark-light.png"
                }
                alt="NexusOS"
                width={210}
                height={37}
                draggable={false}
              />
            </div>
            <div className="truncate text-2xs text-muted-foreground">
              Business Operating System
            </div>
          </motion.div>
        </div>

        <AppNavigation collapsed={collapsed} />

        {/* The system status that used to live here has moved to the shell's
            bottom bar (ShellStatusBar) — deliberately rendered in exactly one
            place, so the two can never disagree. */}
        <div
          className={cn(
            "mt-auto shrink-0 border-t border-line-soft p-3",
            collapsed && "flex flex-col items-center",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "flex-col gap-2",
            )}
          >
            <IconTooltip label="Account" side={collapsed ? "right" : "top"}>
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label="Open account"
              className={cn(
                // Fixed gap-3/px-2/py-1.5 regardless of collapsed — same
                // optically-stable-icon reasoning as the nav rows. flex-1
                // only controls how the button shares space with the
                // bell/logout icons in the row↔column footer switch that
                // 64px of rail requires.
                "focus-ring flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60",
                !collapsed && "flex-1",
              )}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-xs font-semibold"
                aria-hidden="true"
              >
                {userInitial}
              </div>

              <motion.div
                animate={{ width: collapsed ? 0 : "auto", opacity: collapsed ? 0 : 1 }}
                transition={shellCollapseTransition}
                className="min-w-0 overflow-hidden whitespace-nowrap"
                aria-hidden={collapsed}
              >
                <p className="truncate text-sm font-medium">
                  {user?.name ?? "Guest"}
                </p>

                <p className="truncate text-xs text-muted-foreground">
                  {user?.companyName ?? "No company"}
                </p>
              </motion.div>
            </button>
            </IconTooltip>

            <IconTooltip label="Notifications" side={collapsed ? "right" : "top"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="shrink-0"
              onClick={toggleNotificationPanel}
            >
              <Bell />
            </Button>
            </IconTooltip>

            <IconTooltip label={logoutMutation.isPending ? "Logging out" : "Log out"} side={collapsed ? "right" : "top"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                logoutMutation.isPending
                  ? "Logging out"
                  : "Log out"
              }
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={logoutMutation.isPending}
              onClick={handleLogout}
            >
              <LogOut />
            </Button>
            </IconTooltip>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-shell-header shrink-0 items-center gap-3 border-b border-line-soft bg-surface-1/80 px-4 backdrop-blur-xl md:px-6">
          <IconTooltip label="Open navigation">
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
          </IconTooltip>

          <IconTooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
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
          </IconTooltip>

          <div className="hidden h-5 w-px shrink-0 bg-line-soft md:block" aria-hidden="true" />

          <button
            type="button"
            onClick={toggleCommandPalette}
            className="focus-ring flex h-9 flex-1 items-center gap-2 rounded-lg border bg-surface-2 px-3 text-sm text-muted-foreground transition-colors duration-fast hover:border-line-strong hover:text-foreground md:max-w-md"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />

            <span className="flex-1 text-left">
              Search pages and actions…
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
            <IconTooltip label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
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
            </IconTooltip>
          </div>
        </header>

        <OfflineBanner />

        {/* Content is capped and centred (Commit B), and owns the shell's
            scroll (Commit C) so the status bar below stays put.
            focus:outline-none suppresses the platform ring that
            useRouteFocus's fallback would otherwise paint around the whole
            content region — see the note in that hook. tabIndex={-1} means
            this is not Tab-reachable, so no keyboard affordance is lost. */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto focus:outline-none" tabIndex={-1}>
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
    </TooltipProvider>
  );
}
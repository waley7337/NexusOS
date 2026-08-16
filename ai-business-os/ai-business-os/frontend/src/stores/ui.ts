import { create } from "zustand";

/**
 * Where the spatial environment is in its life.
 *
 *   "off"    not rendered — every route except auth
 *   "idle"   the sign-in sky: alive, very slow, sitting behind the form
 *   "travel" the auth-success camera move, above the application
 *
 * It is one value rather than a boolean pair because the two states are
 * mutually exclusive phases of the same object, and because the starfield
 * must survive the transition BETWEEN them without remounting — a remount
 * would reseed the sky and produce exactly the visible cut this replaces.
 */
export type SpaceStage = "off" | "idle" | "travel";

interface UiState {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  /** Part 04, Phase 5 — trigger + empty shell only; panel content ships in Phase 9. */
  isNotificationPanelOpen: boolean;
  /** Part 04, Phase 5 (local state) — lifted to the store in Phase 7 so both
   * AppLayout's topbar trigger and DashboardPage's hero trigger open the
   * same sheet instead of each owning an independent copy. */
  isCaptureOpen: boolean;
  /** Phase F — presentational auth→shell overlay. Armed only by an
   * intentional successful LoginPage submit. Not persisted. Never consulted
   * by auth, routing, or authorization. */
  isAuthEntryActive: boolean;
  /** One-shot Mission Control stagger after auth entry. Cleared by Dashboard. */
  pendingCinematicReveal: boolean;
  /** Spatial environment phase. Presentational; nothing reads it but CSS. */
  spaceStage: SpaceStage;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setNotificationPanelOpen: (open: boolean) => void;
  toggleNotificationPanel: () => void;
  setCaptureOpen: (open: boolean) => void;
  toggleCapture: () => void;
  setSpaceStage: (stage: SpaceStage) => void;
  armAuthEntry: () => void;
  clearAuthEntry: () => void;
  clearCinematicReveal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  isCommandPaletteOpen: false,
  isNotificationPanelOpen: false,
  isCaptureOpen: false,
  isAuthEntryActive: false,
  pendingCinematicReveal: false,
  spaceStage: "off",
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((s) => ({ isMobileSidebarOpen: !s.isMobileSidebarOpen })),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
  setNotificationPanelOpen: (open) => set({ isNotificationPanelOpen: open }),
  toggleNotificationPanel: () => set((s) => ({ isNotificationPanelOpen: !s.isNotificationPanelOpen })),
  setCaptureOpen: (open) => set({ isCaptureOpen: open }),
  toggleCapture: () => set((s) => ({ isCaptureOpen: !s.isCaptureOpen })),
  setSpaceStage: (stage) => set({ spaceStage: stage }),
  armAuthEntry: () =>
    set({
      isAuthEntryActive: true,
      pendingCinematicReveal: true,
      // The sky is already running from the sign-in route; arming only
      // changes how fast the camera is moving through it.
      spaceStage: "travel",
    }),
  clearAuthEntry: () => set({ isAuthEntryActive: false, spaceStage: "off" }),
  clearCinematicReveal: () => set({ pendingCinematicReveal: false }),
}));

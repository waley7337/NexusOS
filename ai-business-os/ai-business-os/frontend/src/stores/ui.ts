import { create } from "zustand";

/** One-shot product rect captured at arm time (pre-navigate). */
export type ImmersionOrigin = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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
  /** Product proxy rect at arm (AuthLayout still mounted). Overlay FLIP source. */
  immersionOrigin: ImmersionOrigin | null;
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
  armAuthEntry: () => void;
  clearAuthEntry: () => void;
  clearCinematicReveal: () => void;
}

function captureImmersionOrigin(): ImmersionOrigin | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-auth-product]");
  if (!(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  isCommandPaletteOpen: false,
  isNotificationPanelOpen: false,
  isCaptureOpen: false,
  isAuthEntryActive: false,
  pendingCinematicReveal: false,
  immersionOrigin: null,
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
  armAuthEntry: () =>
    set({
      isAuthEntryActive: true,
      pendingCinematicReveal: true,
      immersionOrigin: captureImmersionOrigin(),
    }),
  clearAuthEntry: () => set({ isAuthEntryActive: false, immersionOrigin: null }),
  clearCinematicReveal: () => set({ pendingCinematicReveal: false }),
}));

import { create } from "zustand";

interface UiState {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  /** Part 04, Phase 5 — trigger + empty shell only; panel content ships in Phase 9. */
  isNotificationPanelOpen: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setNotificationPanelOpen: (open: boolean) => void;
  toggleNotificationPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  isCommandPaletteOpen: false,
  isNotificationPanelOpen: false,
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((s) => ({ isMobileSidebarOpen: !s.isMobileSidebarOpen })),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
  setNotificationPanelOpen: (open) => set({ isNotificationPanelOpen: open }),
  toggleNotificationPanel: () => set((s) => ({ isNotificationPanelOpen: !s.isNotificationPanelOpen })),
}));

/**
 * Auth store (Zustand).
 * Holds tokens + the current user's identity and tenant context.
 * Persisted so a page refresh doesn't log the user out.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/constants/storage";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  emailVerified?: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: () => boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: () => Boolean(get().accessToken),
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      clear: () =>
        set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: STORAGE_KEYS.auth },
  ),
);
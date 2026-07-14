import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { logout } from "../services/authService";

/** `POST /auth/logout` (revokes the refresh token server-side), then the
 * same local teardown as session expiration (§5.11): clear the store,
 * reset the Query cache — tenant data must not survive logout. */
export function useLogout() {
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);

  return useMutation({
    mutationFn: async () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        await logout(refreshToken).catch(() => undefined); // best-effort; local teardown always happens
      }
    },
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}

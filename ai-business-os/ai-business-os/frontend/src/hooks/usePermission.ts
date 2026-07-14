import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { hasPermission, type Permission } from "@/constants/permissions";
import { getMe, type MeDto } from "@/features/auth";
import { useAuthStore } from "@/stores/auth";

/** Hydrates the current user + flattened permissions from `GET /auth/me`
 * (§5.11) — loads before first render of the protected tree so gated UI
 * never flashes (staleTime: Infinity, `usePermission.ts` is the only
 * consumer that needs a manual `invalidateQueries` after login/logout). */
export function useAuthMe() {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: ({ signal }): Promise<MeDto> => getMe(signal),
    enabled: Boolean(token),
    staleTime: Infinity,
  });
}

/** Returns whether the current user holds `permission`. */
export function usePermission(permission: Permission): boolean {
  const { data } = useAuthMe();
  if (!data) return false;
  return hasPermission(data.permissions, permission);
}

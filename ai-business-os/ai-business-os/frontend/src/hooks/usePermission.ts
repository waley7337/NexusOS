import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  hasPermission,
  permissionsForRole,
  type Permission,
} from "@/constants/permissions";
import { useAuthStore } from "@/stores/auth";

export interface AuthMe {
  permissions: Permission[];
}

/** Hydrates the current user + flattened permissions. Part 6 replaces with GET /auth/me. */
export function useAuthMe() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async (): Promise<AuthMe> => ({
      permissions: [...permissionsForRole(user?.role ?? "viewer")],
    }),
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useAuthStore } from "@/stores/auth";
import { register } from "../services/authService";
import { toAuthUser, type RegisterPayload } from "../types";

/** `POST /auth/register` — creates the company + owner, then behaves like
 * login: the new session is stored immediately (§5.16: module #1 page list
 * has no separate "check your inbox before you can use the app" gate). */
export function useRegister() {
  const queryClient = useQueryClient();
  const { setTokens, setUser } = useAuthStore();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(toAuthUser(data.user));
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

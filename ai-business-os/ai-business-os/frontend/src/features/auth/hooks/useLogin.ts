import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useAuthStore } from "@/stores/auth";
import { login } from "../services/authService";
import { toAuthUser, type LoginPayload } from "../types";

/** `POST /auth/login` → store tokens + user (§5.11). */
export function useLogin() {
  const queryClient = useQueryClient();
  const { setTokens, setUser } = useAuthStore();

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      setUser(toAuthUser(data.user));
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

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
      console.log("========== LOGIN SUCCESS ==========");
      console.log("Backend response:", data);

      console.log("Store BEFORE:", useAuthStore.getState());

      setTokens(data.accessToken, data.refreshToken);

      console.log("Store AFTER setTokens:", useAuthStore.getState());

      setUser(toAuthUser(data.user));

      console.log("Store AFTER setUser:", useAuthStore.getState());

      queryClient.invalidateQueries({
        queryKey: queryKeys.auth.all,
      });
    },

    onError: (error) => {
      console.error("========== LOGIN ERROR ==========");
      console.error(error);
    },
  });
}
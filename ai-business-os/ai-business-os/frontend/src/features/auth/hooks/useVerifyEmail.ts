import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { verifyEmail } from "../services/authService";
import type { VerifyEmailPayload } from "../types";

export function useVerifyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: VerifyEmailPayload) => verifyEmail(payload),
    onSuccess: () => {
      // the signed-in user's `emailVerified` flag may now be stale
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });
}

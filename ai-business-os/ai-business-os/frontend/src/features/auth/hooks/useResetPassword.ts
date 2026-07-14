import { useMutation } from "@tanstack/react-query";
import { resetPassword } from "../services/authService";
import type { ResetPasswordPayload } from "../types";

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => resetPassword(payload),
  });
}

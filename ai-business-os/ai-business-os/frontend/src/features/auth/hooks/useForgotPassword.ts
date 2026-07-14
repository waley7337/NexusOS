import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "../services/authService";
import type { ForgotPasswordPayload } from "../types";

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => forgotPassword(payload),
  });
}

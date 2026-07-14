export { useLogin } from "./hooks/useLogin";
export { useRegister } from "./hooks/useRegister";
export { useLogout } from "./hooks/useLogout";
export { useForgotPassword } from "./hooks/useForgotPassword";
export { useResetPassword } from "./hooks/useResetPassword";
export { useVerifyEmail } from "./hooks/useVerifyEmail";

export { getMe } from "./services/authService";

export { loginSchema, type LoginFormValues } from "./schemas/loginSchema";
export { registerSchema, type RegisterFormValues } from "./schemas/registerSchema";
export {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "./schemas/forgotPasswordSchema";
export { resetPasswordSchema, type ResetPasswordFormValues } from "./schemas/resetPasswordSchema";

export type {
  AuthSessionDto,
  AuthUserDto,
  MeDto,
  RegisterPayload,
  LoginPayload,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from "./types";

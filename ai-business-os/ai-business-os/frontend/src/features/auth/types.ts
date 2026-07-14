/** DTOs mirroring `backend/app/schemas/auth.py` — camelCase on the wire. */
import type { AuthUser } from "@/stores/auth";

export interface AuthUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  companyId: string;
  companyName: string;
  emailVerified: boolean;
}

export interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSessionDto extends TokenPairDto {
  user: AuthUserDto;
}

export interface MeDto {
  user: AuthUserDto;
  permissions: string[];
}

export interface RegisterPayload {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface VerifyEmailPayload {
  token: string;
}

/** Maps the wire DTO to the auth store's shape — shared by `useLogin` and
 * `useRegister`, which both persist the session's user the same way. */
export function toAuthUser(dto: AuthUserDto): AuthUser {
  return {
    id: dto.id,
    email: dto.email,
    name: dto.fullName,
    role: dto.role,
    companyId: dto.companyId,
    companyName: dto.companyName,
    emailVerified: dto.emailVerified,
  };
}

/** Reset password — §5.16. Reads the single-use token from the URL
 * (state comes from the URL, not memory — §5.6) and calls
 * `POST /auth/reset-password`. */
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Eye, EyeOff, Lock } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useResetPassword, resetPasswordSchema, type ResetPasswordFormValues } from "@/features/auth";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const [showPassword, setShowPassword] = useState(false);
  const resetPassword = useResetPassword();
  const passwordId = useId();
  const confirmPasswordId = useId();

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-h2 text-foreground">Invalid reset link</h1>
          <p className="text-body text-muted-foreground">
            This password reset link is missing or malformed. Request a new one to continue.
          </p>
        </div>
        <Link to={ROUTES.forgotPassword}>
          <Button variant="primary" size="lg" className="h-11 w-full">
            Request a new link
          </Button>
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: ResetPasswordFormValues) => {
    try {
      await resetPassword.mutateAsync({ token, password: values.password });
      toast.success("Password updated. Sign in with your new password.");
      navigate(ROUTES.login, { replace: true });
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "This link is invalid or has expired.";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">Set a new password</h1>
        <p className="text-body text-muted-foreground">Choose a strong password for your account.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={passwordId}>New password</Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? `${passwordId}-error` : undefined}
              className="h-11 bg-background pl-10 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password ? (
            <p id={`${passwordId}-error`} role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">At least 8 characters, with letters and numbers.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={confirmPasswordId}>Confirm new password</Label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={confirmPasswordId}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={errors.confirmPassword ? `${confirmPasswordId}-error` : undefined}
              className="h-11 bg-background pl-10"
              {...register("confirmPassword")}
            />
          </div>
          {errors.confirmPassword && (
            <p id={`${confirmPasswordId}-error`} role="alert" className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isSubmitting || resetPassword.isPending}
        className="h-11 w-full"
      >
        {isSubmitting || resetPassword.isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

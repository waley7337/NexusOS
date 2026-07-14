/**
 * Register (company + owner) — §5.16 module #1. `POST /auth/register`
 * bootstraps a new tenant + its Owner role, then behaves like login.
 */
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useRegister, registerSchema, type RegisterFormValues } from "@/features/auth";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const registerMutation = useRegister();

  const companyId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync(values);
      toast.success("Account created. Welcome to NexusOS.");
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Something went wrong. Try again.";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">Create your account</h1>
        <p className="text-body text-muted-foreground">Set up your company workspace in NexusOS.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={companyId}>Company name</Label>
          <div className="relative">
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={companyId}
              autoComplete="organization"
              placeholder="Acme Inc."
              aria-invalid={errors.companyName ? true : undefined}
              aria-describedby={errors.companyName ? `${companyId}-error` : undefined}
              className="h-11 bg-background pl-10"
              {...register("companyName")}
            />
          </div>
          {errors.companyName && (
            <p id={`${companyId}-error`} role="alert" className="text-xs text-destructive">
              {errors.companyName.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={firstNameId}>First name</Label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={firstNameId}
                autoComplete="given-name"
                placeholder="Jane"
                aria-invalid={errors.firstName ? true : undefined}
                aria-describedby={errors.firstName ? `${firstNameId}-error` : undefined}
                className="h-11 bg-background pl-10"
                {...register("firstName")}
              />
            </div>
            {errors.firstName && (
              <p id={`${firstNameId}-error`} role="alert" className="text-xs text-destructive">
                {errors.firstName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={lastNameId}>Last name</Label>
            <Input
              id={lastNameId}
              autoComplete="family-name"
              placeholder="Doe"
              aria-invalid={errors.lastName ? true : undefined}
              aria-describedby={errors.lastName ? `${lastNameId}-error` : undefined}
              className="h-11 bg-background"
              {...register("lastName")}
            />
            {errors.lastName && (
              <p id={`${lastNameId}-error`} role="alert" className="text-xs text-destructive">
                {errors.lastName.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={emailId}>Work email</Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={emailId}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? `${emailId}-error` : undefined}
              className="h-11 bg-background pl-10"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p id={`${emailId}-error`} role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={passwordId}>Password</Label>
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
          <Label htmlFor={confirmPasswordId}>Confirm password</Label>
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
        loading={isSubmitting || registerMutation.isPending}
        className="h-11 w-full"
      >
        {isSubmitting || registerMutation.isPending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to={ROUTES.login}
          className="font-medium text-primary transition-colors duration-fast hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

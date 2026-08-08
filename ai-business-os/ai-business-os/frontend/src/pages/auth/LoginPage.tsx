/**
 * Login — §5.11. `POST /auth/login` → store tokens + user → redirect to the
 * originally requested URL (captured by ProtectedRoute) or `/`.
 */
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useLogin, loginSchema, type LoginFormValues } from "@/features/auth";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const login = useLogin();

  const companySlugId = useId();
  const emailId = useId();
  const passwordId = useId();
  const companySlugErrorId = `${companySlugId}-error`;
  const emailErrorId = `${emailId}-error`;
  const passwordErrorId = `${passwordId}-error`;

  useEffect(() => {
    if (searchParams.get("sessionExpired")) {
      toast.error("Your session expired — sign in to continue.");
    }
  }, [searchParams]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login.mutateAsync(values);
      toast.success("Signed in.");
      const state = location.state as LocationState | null;
      navigate(state?.from?.pathname ?? ROUTES.home, { replace: true });
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Something went wrong. Try again.";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">Sign in</h1>
        <p className="text-body text-muted-foreground">Welcome back. Enter your details to continue.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={companySlugId}>Company URL</Label>
          <div className="relative">
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={companySlugId}
              type="text"
              autoComplete="organization"
              placeholder="acme"
              aria-invalid={errors.companySlug ? true : undefined}
              aria-describedby={errors.companySlug ? companySlugErrorId : undefined}
              className="h-11 bg-background pl-10"
              {...register("companySlug")}
            />
          </div>
          {errors.companySlug && (
            <p id={companySlugErrorId} role="alert" className="text-xs text-destructive">
              {errors.companySlug.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={emailId}>Email</Label>
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
              aria-describedby={errors.email ? emailErrorId : undefined}
              className="h-11 bg-background pl-10"
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p id={emailErrorId} role="alert" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={passwordId}>Password</Label>
            <Link
              to={ROUTES.forgotPassword}
              className="text-xs font-medium text-primary transition-colors duration-fast hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? passwordErrorId : undefined}
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
          {errors.password && (
            <p id={passwordErrorId} role="alert" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isSubmitting || login.isPending}
        className="h-11 w-full"
      >
        {isSubmitting || login.isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to NexusOS?{" "}
        <Link
          to={ROUTES.register}
          className="font-medium text-primary transition-colors duration-fast hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
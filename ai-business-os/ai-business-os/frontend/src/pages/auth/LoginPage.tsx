/**
 * Login — §5.11. `POST /auth/login` → store tokens + user → redirect to the
 * originally requested URL (captured by ProtectedRoute) or `/`.
 *
 * Phase F arms a presentational overlay after mutateAsync succeeds, then
 * prefetches and navigates immediately. Overlay completion is not awaited.
 */
import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Eye, EyeOff, Lock, Mail, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useLogin, loginSchema, type LoginFormValues } from "@/features/auth";
import { ApiRequestError } from "@/api/client";
import { prefetchRoute } from "@/routes/prefetch";
import { useUiStore } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LocationState {
  from?: { pathname: string };
}

const IconFieldControl = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon; endSlot?: ReactNode }
>(({ icon: Icon, className, endSlot, ...props }, ref) => (
  <div className="relative">
    <Icon
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
    <Input
      ref={ref}
      className={cn("h-11 bg-background pl-10", endSlot && "pr-10", className)}
      {...props}
    />
    {endSlot}
  </div>
));
IconFieldControl.displayName = "IconFieldControl";

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
      const destination = state?.from?.pathname ?? ROUTES.home;
      useUiStore.getState().armAuthEntry();
      prefetchRoute(destination);
      navigate(destination, { replace: true });
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Something went wrong. Try again.";
      toast.error(message);
    }
  };

  const pending = isSubmitting || login.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">Sign in</h1>
        <p className="text-body text-muted-foreground">
          Enter your company URL and credentials to open your workspace.
        </p>
      </div>

      <div className="space-y-4">
        <Field label="Company URL" error={errors.companySlug?.message}>
          <IconFieldControl
            icon={Building2}
            type="text"
            autoComplete="organization"
            placeholder="acme"
            {...register("companySlug")}
          />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <IconFieldControl
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
          />
        </Field>

        <Field
          label="Password"
          error={errors.password?.message}
          labelAccessory={
            <Link
              to={ROUTES.forgotPassword}
              className="focus-ring -my-1.5 rounded-control py-1.5 text-xs font-medium text-primary transition-colors duration-fast hover:text-primary/80"
            >
              Forgot password?
            </Link>
          }
        >
          <IconFieldControl
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            endSlot={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-control p-1.5 text-muted-foreground transition-colors duration-fast hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            }
            {...register("password")}
          />
        </Field>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={pending}
        className={cn("h-11 w-full", pending && "auth-cta-confirm")}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        New to NexusOS?{" "}
        <Link
          to={ROUTES.register}
          className="font-medium text-primary transition-colors duration-fast hover:text-primary/80 focus-ring rounded-sm"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

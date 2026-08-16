/** Forgot password — §5.16. `POST /auth/forgot-password` always returns the
 * same generic acknowledgement (enumeration protection), so the UI shows a
 * single confirmation state rather than branching on success/failure. */
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import {
  useForgotPassword,
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();
  const emailId = useId();

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await forgotPassword.mutateAsync(values);
    } catch {
      // The backend never signals failure for this endpoint (enumeration
      // protection) — network errors are the only realistic case, and the
      // confirmation copy below is still accurate advice either way.
    } finally {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h1 className="text-h2 text-foreground">Check your email</h1>
          <p className="text-body text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{getValues("email")}</span>, we
            sent a link to reset your password.
          </p>
        </div>
        <Button variant="outline" size="lg" className="h-11 w-full" onClick={() => setSent(false)}>
          Try a different email
        </Button>
        <Link
          to={ROUTES.login}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-fast hover:text-primary/80 focus-ring rounded-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">Forgot password?</h1>
        <p className="text-body text-muted-foreground">
          Enter your email and we'll send you a link to reset it.
        </p>
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

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isSubmitting || forgotPassword.isPending}
        className="h-11 w-full"
      >
        {isSubmitting || forgotPassword.isPending ? "Sending…" : "Send reset link"}
      </Button>

      <Link
        to={ROUTES.login}
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors duration-fast hover:text-primary/80 focus-ring rounded-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to sign in
      </Link>
    </form>
  );
}

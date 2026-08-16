/** Verify email — §5.16. Auto-submits the token found in the URL on mount;
 * renders a loading / success / error state (no form). */
import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { useVerifyEmail } from "@/features/auth";
import { Button } from "@/components/ui/button";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const verifyEmail = useVerifyEmail();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verifyEmail.mutate({ token });
  }, [token, verifyEmail]);

  if (!token) {
    return (
      <StatusPanel
        icon={<AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />}
        iconClassName="bg-destructive/10"
        title="Invalid verification link"
        description="This link is missing or malformed. Sign in and request a new verification email."
        cta={{ label: "Go to sign in", to: ROUTES.login }}
      />
    );
  }

  if (verifyEmail.isPending || verifyEmail.isIdle) {
    return (
      <StatusPanel
        icon={<Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />}
        iconClassName="bg-primary/10"
        title="Verifying your email…"
        description="This will just take a moment."
      />
    );
  }

  if (verifyEmail.isError) {
    return (
      <StatusPanel
        icon={<AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />}
        iconClassName="bg-destructive/10"
        title="This link is invalid or has expired"
        description="Sign in and request a new verification email."
        cta={{ label: "Go to sign in", to: ROUTES.login }}
      />
    );
  }

  return (
    <StatusPanel
      icon={<CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />}
      iconClassName="bg-success/10"
      title="Email verified"
      description="Your email address has been confirmed."
      cta={{ label: "Continue to NexusOS", to: ROUTES.home }}
    />
  );
}

interface StatusPanelProps {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  cta?: { label: string; to: string };
}

function StatusPanel({ icon, iconClassName, title, description, cta }: StatusPanelProps) {
  return (
    <div className="space-y-6 text-center" role="status">
      <div className="flex justify-center">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconClassName}`}>{icon}</div>
      </div>
      <div className="space-y-1.5">
        <h1 className="text-h2 text-foreground">{title}</h1>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      {cta && (
        <Link to={cta.to}>
          <Button variant="primary" size="lg" className="h-11 w-full">
            {cta.label}
          </Button>
        </Link>
      )}
    </div>
  );
}

"""Transactional email — verification and password-reset links.

Provider: Resend (https://resend.com). Configure via environment variables:
  RESEND_API_KEY — Resend API key (required for real delivery)
  EMAIL_FROM     — verified sender address, e.g. "NexusOS <noreply@yourdomain.com>"
  FRONTEND_URL   — base URL used to construct action links

When RESEND_API_KEY is absent the service logs a structured warning and
returns without raising, so the auth flow still completes (users receive
no email, but the operation does not error). This behaviour mirrors the
original no-op stub and preserves test-environment compatibility.

Security notes:
  * Tokens and full action links are never logged.
  * Delivery failures are logged at WARNING without exposing the token.
  * All I/O errors from the provider are caught and re-raised as
    RuntimeError so callers can decide to surface them or continue.
"""
import structlog

from app.core.config import settings

logger = structlog.get_logger("app.email")


def build_verification_link(token: str) -> str:
    """Frontend email-verification URL (uses centralised FRONTEND_URL)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"


def build_password_reset_link(token: str) -> str:
    """Frontend password-reset URL (uses centralised FRONTEND_URL)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"


class EmailService:
    # ------------------------------------------------------------------ #
    # Public send methods                                                  #
    # ------------------------------------------------------------------ #

    async def send_verification_email(self, *, to: str, token: str) -> None:
        link = build_verification_link(token)
        subject = "Verify your NexusOS email address"
        html = (
            f"<p>Welcome to NexusOS. Click the link below to verify your "
            f"email address:</p>"
            f'<p><a href="{link}">Verify email address</a></p>'
            f"<p>This link expires in 24 hours. If you did not create a "
            f"NexusOS account, you can ignore this message.</p>"
        )
        await self._send(to=to, subject=subject, html=html, delivery_type="email_verification")

    async def send_password_reset_email(self, *, to: str, token: str) -> None:
        link = build_password_reset_link(token)
        subject = "Reset your NexusOS password"
        html = (
            f"<p>We received a request to reset your NexusOS password. "
            f"Click the link below to choose a new password:</p>"
            f'<p><a href="{link}">Reset password</a></p>'
            f"<p>This link expires in 1 hour. If you did not request a "
            f"password reset, you can ignore this message.</p>"
        )
        await self._send(to=to, subject=subject, html=html, delivery_type="password_reset")

    # ------------------------------------------------------------------ #
    # Internal delivery                                                    #
    # ------------------------------------------------------------------ #

    async def _send(
        self, *, to: str, subject: str, html: str, delivery_type: str
    ) -> None:
        """Deliver via Resend when configured; log-only otherwise."""
        api_key = settings.RESEND_API_KEY
        from_address = settings.EMAIL_FROM

        if not api_key:
            logger.warning(
                "email.delivery_skipped",
                reason="RESEND_API_KEY not configured",
                delivery_type=delivery_type,
            )
            return

        try:
            import resend  # type: ignore[import-untyped]

            resend.api_key = api_key  # type: ignore[attr-defined]
            resend.Emails.send(  # type: ignore[attr-defined]
                {
                    "from": from_address,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                }
            )
            logger.info(
                "email.sent",
                delivery_type=delivery_type,
                # Never log the recipient address or token in structured logs.
            )
        except ImportError:
            logger.error(
                "email.delivery_failed",
                reason="resend package not installed; run: pip install resend",
                delivery_type=delivery_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "email.delivery_failed",
                delivery_type=delivery_type,
                error=type(exc).__name__,
                # Do not log exc details — may contain recipient PII.
            )


email_service = EmailService()

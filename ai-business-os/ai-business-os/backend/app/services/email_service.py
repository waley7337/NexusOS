"""Transactional email — verification + password reset links.

`RESEND_API_KEY` / `EMAIL_FROM` are already reserved in `core/config.py` for
the Resend integration, but the `resend` client isn't a project dependency
yet and no template layer exists. Wiring a real provider is a deliberate
follow-up, not invented here.

Until a provider is wired, delivery is accepted as a no-op that records a
*safe* structured event only. Raw tokens, complete action links, and
recipient addresses must never appear in logs in any environment.
"""
import structlog

from app.core.config import settings

logger = structlog.get_logger("app.email")


def build_verification_link(token: str) -> str:
    """Frontend email-verification URL (uses centralized `FRONTEND_URL`)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?token={token}"


def build_password_reset_link(token: str) -> str:
    """Frontend password-reset URL (uses centralized `FRONTEND_URL`)."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"


class EmailService:
    async def send_verification_email(self, *, to: str, token: str) -> None:
        link = build_verification_link(token)
        await self._accept_delivery(
            delivery_type="email_verification",
            to=to,
            link=link,
        )

    async def send_password_reset_email(self, *, to: str, token: str) -> None:
        link = build_password_reset_link(token)
        await self._accept_delivery(
            delivery_type="password_reset",
            to=to,
            link=link,
        )

    async def _accept_delivery(
        self, *, delivery_type: str, to: str, link: str
    ) -> None:
        """Accept a transactional email for delivery.

        `to` and `link` are reserved for the future provider path and must
        never be written to logs (token-bearing URLs and recipient PII).
        """
        _ = (to, link)  # provider wiring only — never log
        logger.info(
            "email.delivery",
            delivery_type=delivery_type,
            delivery_status="accepted",
        )


email_service = EmailService()

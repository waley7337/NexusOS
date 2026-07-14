"""Transactional email — verification + password reset links.

`RESEND_API_KEY` / `EMAIL_FROM` are already reserved in `core/config.py` for
the Resend integration, but the `resend` client isn't a project dependency
yet and no template layer exists. Wiring a real provider is a deliberate
follow-up (flagged in the Part 02 implementation report), not invented here.

Until then, every environment logs the link at INFO — correct and testable
in dev/CI, and the seam (`EmailService`) is the only place a real provider
needs to be dropped in later.
"""
import structlog

from app.core.config import settings

logger = structlog.get_logger("app.email")


class EmailService:
    async def send_verification_email(self, *, to: str, token: str) -> None:
        link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        logger.info("email.verification", to=to, link=link, from_=settings.EMAIL_FROM)

    async def send_password_reset_email(self, *, to: str, token: str) -> None:
        link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        logger.info("email.password_reset", to=to, link=link, from_=settings.EMAIL_FROM)


email_service = EmailService()

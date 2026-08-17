"""Manual payment provider — no external API calls."""
from __future__ import annotations

from app.models.enums import PaymentSource


class ManualPaymentProvider:
    provider_name = "manual"
    source = PaymentSource.MANUAL

"""Reports summary SQL must use persisted enum *names* and wire values."""

from __future__ import annotations

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

from app.api.v1 import reports as reports_module
from app.models.enums import DealStatus, InvoiceStatus, PaymentStatus, PipelineStage


def test_reports_sql_literals_use_persisted_enum_names():
    assert reports_module._PAYMENT_COMPLETED == PaymentStatus.COMPLETED.name == "COMPLETED"
    assert "WON" in reports_module._CLOSED_LEAD_SQL
    assert "LOST" in reports_module._CLOSED_LEAD_SQL
    assert "closed_won" not in reports_module._CLOSED_LEAD_SQL
    assert "WON" in reports_module._CLOSED_DEAL_SQL
    assert DealStatus.WON.name == "WON"
    assert PipelineStage.LOST.name == "LOST"


def test_invoice_status_keys_are_wire_values_not_db_names():
    assert reports_module._invoice_status_key("DRAFT") == InvoiceStatus.DRAFT.value == "draft"
    assert reports_module._invoice_status_key("PARTIALLY_PAID") == "partially_paid"
    assert reports_module._invoice_status_key("sent") == "sent"

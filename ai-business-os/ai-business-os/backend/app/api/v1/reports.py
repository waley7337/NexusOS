"""Reports API — server-side aggregations across Finance, CRM, Inventory.

All queries are tenant-scoped. Aggregations use server-side SQL so large
datasets do not require fetching all rows to the application layer.

Permissions: reports.view
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.db.session import get_db
from app.models.enums import DealStatus, InvoiceStatus, PaymentStatus, PipelineStage
from app.schemas.response import ApiResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/reports", tags=["Reports"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]

# SQLAlchemy Enum(native_enum=False) persists enum *names* (DRAFT, COMPLETED).
# Wire responses still use lowercase *values* to match the rest of the API.
# Literals below are derived from enums (not user input) so raw SQL stays safe.
_PAYMENT_COMPLETED = PaymentStatus.COMPLETED.name  # COMPLETED
_CLOSED_LEAD_SQL = ", ".join(
    f"'{stage.name}'" for stage in (PipelineStage.WON, PipelineStage.LOST)
)
_CLOSED_DEAL_SQL = ", ".join(
    f"'{status.name}'" for status in (DealStatus.WON, DealStatus.LOST)
)


def _invoice_status_key(raw: str) -> str:
    try:
        return InvoiceStatus[raw].value
    except KeyError:
        return raw.lower()


@router.get(
    "/summary",
    dependencies=[Depends(require_permission("reports.view"))],
)
async def get_report_summary(
    db: DbSession,
    user: ActiveUser,
    from_date: Annotated[date | None, Query(alias="fromDate")] = None,
    to_date: Annotated[date | None, Query(alias="toDate")] = None,
) -> ApiResponse[dict]:
    """Return high-level tenant summary across Finance, CRM, Inventory."""
    # Default: last 30 days
    if to_date is None:
        to_date = date.today()
    if from_date is None:
        from_date = to_date - timedelta(days=30)

    company_id = str(user.company_id)

    # Finance: invoice counts + totals by status
    invoice_rows = (
        await db.execute(
            text(
                """
                SELECT status,
                       COUNT(*) AS count,
                       COALESCE(SUM(total), 0) AS total_amount
                FROM invoices
                WHERE company_id = :company_id
                  AND deleted_at IS NULL
                  AND issue_date BETWEEN :from_date AND :to_date
                GROUP BY status
                """
            ),
            {"company_id": company_id, "from_date": from_date, "to_date": to_date},
        )
    ).fetchall()

    invoice_summary: dict[str, dict] = {}
    for row in invoice_rows:
        invoice_summary[_invoice_status_key(str(row.status))] = {
            "count": int(row.count),
            "totalAmount": str(row.total_amount),
        }

    # Finance: payments recorded in the period
    payment_rows = (
        await db.execute(
            text(
                f"""
                SELECT COUNT(*) AS count,
                       COALESCE(SUM(amount - refunded_amount), 0) AS net_paid
                FROM payments
                WHERE company_id = :company_id
                  AND deleted_at IS NULL
                  AND status = '{_PAYMENT_COMPLETED}'
                  AND payment_date BETWEEN :from_date AND :to_date
                """
            ),
            {
                "company_id": company_id,
                "from_date": from_date,
                "to_date": to_date,
            },
        )
    ).fetchone()

    # CRM: pipeline counts (open = not WON/LOST — matches dashboard SQL)
    crm_rows = (
        await db.execute(
            text(
                f"""
                SELECT
                  (SELECT COUNT(*) FROM customers WHERE company_id = :company_id AND deleted_at IS NULL) AS customer_count,
                  (SELECT COUNT(*) FROM leads WHERE company_id = :company_id AND deleted_at IS NULL AND pipeline_stage NOT IN ({_CLOSED_LEAD_SQL})) AS open_lead_count,
                  (SELECT COUNT(*) FROM deals WHERE company_id = :company_id AND deleted_at IS NULL AND status NOT IN ({_CLOSED_DEAL_SQL})) AS open_deal_count
                """
            ),
            {"company_id": company_id},
        )
    ).fetchone()

    # Inventory: low-stock count
    low_stock_row = (
        await db.execute(
            text(
                """
                SELECT COUNT(*) AS low_stock_count
                FROM inventory
                WHERE company_id = :company_id
                  AND deleted_at IS NULL
                  AND quantity <= minimum_quantity
                """
            ),
            {"company_id": company_id},
        )
    ).fetchone()

    return ApiResponse.ok(
        data={
            "period": {"fromDate": str(from_date), "toDate": str(to_date)},
            "finance": {
                "invoicesByStatus": invoice_summary,
                "paymentsCollected": {
                    "count": int(payment_rows.count) if payment_rows else 0,
                    "netPaid": str(payment_rows.net_paid) if payment_rows else "0",
                },
            },
            "crm": {
                "customerCount": int(crm_rows.customer_count) if crm_rows else 0,
                "openLeadCount": int(crm_rows.open_lead_count) if crm_rows else 0,
                "openDealCount": int(crm_rows.open_deal_count) if crm_rows else 0,
            },
            "inventory": {
                "lowStockCount": int(low_stock_row.low_stock_count) if low_stock_row else 0,
            },
        }
    )

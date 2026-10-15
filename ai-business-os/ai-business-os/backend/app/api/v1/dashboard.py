"""Dashboard metrics endpoint — tenant-scoped operational KPIs.

Returns live aggregations across Finance, CRM, Projects, HR, and Inventory.
No external permission beyond authentication is required; this is the
"home screen" summary that every signed-in user sees.

All queries are:
  * Tenant-scoped via company_id parameter (never trusting caller-supplied IDs
    from the JSON body; company_id always comes from the verified session user).
  * Parameterized — no string interpolation in SQL.
  * Using indexed columns only (verified against existing schema indexes).

Index usage per query:
  invoices    → ix_invoices_company_status    (company_id, status)
  payments    → ix_payments_company_payment_date_id  (company_id, payment_date, id)
  customers   → ix_customers_company_id
  leads       → ix_leads_company_id
  deals       → ix_deals_company_id
  projects    → ix_projects_company_status    (company_id, status)
  tasks       → ix_tasks_company_status + ix_tasks_company_due
  employees   → ix_employees_company_id
  inventory   → ix_inventory_company_id + uq_inventory_warehouse_product
"""
from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db
from app.dependencies.auth import CurrentUser, get_current_active_user
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


@router.get("/metrics")
async def get_dashboard_metrics(
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[dict]:
    """Return live tenant-scoped operational metrics for the dashboard.

    All counts exclude soft-deleted rows (deleted_at IS NULL).
    Monetary values are returned as strings to preserve Decimal precision.
    """
    cid = str(user.company_id)

    today = date.today()
    month_start = today.replace(day=1)

    # ------------------------------------------------------------------ #
    # Finance: open/overdue invoices + revenue collected this month       #
    # Uses ix_invoices_company_status and ix_payments_company_payment_date_id
    # ------------------------------------------------------------------ #
    finance_row = (
        await db.execute(
            text(
                """
                SELECT
                  COUNT(*) FILTER (
                    WHERE status IN ('SENT', 'PARTIALLY_PAID', 'OVERDUE')
                  ) AS open_invoice_count,
                  COUNT(*) FILTER (WHERE status = 'OVERDUE') AS overdue_invoice_count,
                  COALESCE(SUM(total) FILTER (
                    WHERE status IN ('SENT', 'PARTIALLY_PAID', 'OVERDUE')
                  ), 0) AS outstanding_amount
                FROM invoices
                WHERE company_id = :cid
                  AND deleted_at IS NULL
                """
            ),
            {"cid": cid},
        )
    ).fetchone()

    payment_row = (
        await db.execute(
            text(
                """
                SELECT
                  COUNT(*) AS payment_count,
                  COALESCE(SUM(amount - refunded_amount), 0) AS collected_amount
                FROM payments
                WHERE company_id = :cid
                  AND deleted_at IS NULL
                  AND status = 'COMPLETED'
                  AND payment_date >= :month_start
                  AND payment_date <= :today
                """
            ),
            {"cid": cid, "month_start": month_start, "today": today},
        )
    ).fetchone()

    # ------------------------------------------------------------------ #
    # CRM: customer, lead, deal counts                                    #
    # Uses company_id indexes on each table                               #
    # ------------------------------------------------------------------ #
    crm_row = (
        await db.execute(
            text(
                """
                SELECT
                  (SELECT COUNT(*) FROM customers
                   WHERE company_id = :cid AND deleted_at IS NULL
                  ) AS customer_count,
                  (SELECT COUNT(*) FROM leads
                   WHERE company_id = :cid AND deleted_at IS NULL
                     AND pipeline_stage NOT IN ('WON', 'LOST')
                  ) AS open_lead_count,
                  (SELECT COUNT(*) FROM deals
                   WHERE company_id = :cid AND deleted_at IS NULL
                     AND status NOT IN ('WON', 'LOST')
                  ) AS open_deal_count
                """
            ),
            {"cid": cid},
        )
    ).fetchone()

    # ------------------------------------------------------------------ #
    # Projects + Tasks: active projects, overdue tasks                    #
    # Uses ix_projects_company_status, ix_tasks_company_status,           #
    # ix_tasks_company_due                                                #
    # ------------------------------------------------------------------ #
    projects_row = (
        await db.execute(
            text(
                """
                SELECT
                  COUNT(*) FILTER (WHERE status = 'ACTIVE') AS active_project_count,
                  COUNT(*) AS total_project_count
                FROM projects
                WHERE company_id = :cid AND deleted_at IS NULL
                """
            ),
            {"cid": cid},
        )
    ).fetchone()

    tasks_row = (
        await db.execute(
            text(
                """
                SELECT
                  COUNT(*) FILTER (
                    WHERE due_date < :today
                      AND status NOT IN ('DONE', 'CANCELED')
                  ) AS overdue_task_count,
                  COUNT(*) FILTER (
                    WHERE status NOT IN ('DONE', 'CANCELED')
                  ) AS open_task_count
                FROM tasks
                WHERE company_id = :cid AND deleted_at IS NULL
                """
            ),
            {"cid": cid, "today": today},
        )
    ).fetchone()

    # ------------------------------------------------------------------ #
    # HR: active employee count (excludes on-leave + terminated)          #
    # ------------------------------------------------------------------ #
    hr_row = (
        await db.execute(
            text(
                """
                SELECT COUNT(*) AS employee_count
                FROM employees
                WHERE company_id = :cid
                  AND deleted_at IS NULL
                  AND status = 'ACTIVE'
                """
            ),
            {"cid": cid},
        )
    ).fetchone()

    # ------------------------------------------------------------------ #
    # Inventory: low-stock item count                                     #
    # ------------------------------------------------------------------ #
    inventory_row = (
        await db.execute(
            text(
                """
                SELECT COUNT(*) AS low_stock_count
                FROM inventory
                WHERE company_id = :cid
                  AND deleted_at IS NULL
                  AND quantity <= minimum_quantity
                """
            ),
            {"cid": cid},
        )
    ).fetchone()

    return ApiResponse.ok(
        data={
            "asOf": today.isoformat(),
            "monthStart": month_start.isoformat(),
            "finance": {
                "openInvoiceCount": int(finance_row.open_invoice_count) if finance_row else 0,
                "overdueInvoiceCount": int(finance_row.overdue_invoice_count) if finance_row else 0,
                "outstandingAmount": str(finance_row.outstanding_amount) if finance_row else "0",
                "collectedThisMonth": str(payment_row.collected_amount) if payment_row else "0",
                "collectedPaymentCount": int(payment_row.payment_count) if payment_row else 0,
            },
            "crm": {
                "customerCount": int(crm_row.customer_count) if crm_row else 0,
                "openLeadCount": int(crm_row.open_lead_count) if crm_row else 0,
                "openDealCount": int(crm_row.open_deal_count) if crm_row else 0,
            },
            "projects": {
                "activeProjectCount": int(projects_row.active_project_count) if projects_row else 0,
                "totalProjectCount": int(projects_row.total_project_count) if projects_row else 0,
                "openTaskCount": int(tasks_row.open_task_count) if tasks_row else 0,
                "overdueTaskCount": int(tasks_row.overdue_task_count) if tasks_row else 0,
            },
            "hr": {
                "employeeCount": int(hr_row.employee_count) if hr_row else 0,
            },
            "inventory": {
                "lowStockCount": int(inventory_row.low_stock_count) if inventory_row else 0,
            },
        }
    )

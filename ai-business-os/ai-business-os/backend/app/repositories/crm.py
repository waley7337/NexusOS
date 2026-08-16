"""CRM repositories — thin BaseRepository subclasses.

Tenant scoping, soft-delete filtering, protected-field rejection, and
pagination/sort clamping all come from BaseRepository. These classes only
bind the ORM model and an explicit sort allowlist.

CustomerRepository also owns bounded list filters (search / status / owner)
built on top of `_base_query()` so tenant predicates stay fundamental to
every SELECT.
"""

from __future__ import annotations

import uuid
from typing import List

from sqlalchemy import func, or_, select

from app.core.exceptions import ValidationError
from app.models.crm import Contact, Customer, Deal, Lead
from app.models.enums import CustomerStatus
from app.models.user import User
from app.repositories.base import DEFAULT_PAGE_SIZE, BaseRepository

_MAX_SEARCH_LEN = 100


def _ilike_contains(raw: str) -> str:
    """Escape LIKE metacharacters, then wrap as a contains pattern."""
    escaped = (
        raw.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
    return f"%{escaped}%"


class CustomerRepository(BaseRepository[Customer]):
    model = Customer
    SORT_FIELDS = {
        "created_at": Customer.created_at,
        "company_name": Customer.company_name,
        "status": Customer.status,
    }

    async def ensure_owner_in_tenant(self, owner_id: uuid.UUID) -> None:
        """Reject owners that are missing, soft-deleted, or other-tenant.

        Fail closed with ValidationError (422) — never reveal whether the
        UUID exists in another company.
        """
        self._require_tenant_context()
        stmt = select(User.id).where(
            User.id == owner_id,
            User.company_id == self.company_id,
            User.deleted_at.is_(None),
        )
        found = (await self.db.execute(stmt)).scalar_one_or_none()
        if found is None:
            raise ValidationError("Owner must belong to the current company.")

    async def list_filtered(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        search: str | None = None,
        status: CustomerStatus | None = None,
        owner_id: uuid.UUID | None = None,
    ) -> tuple[List[Customer], int]:
        """Tenant-scoped list with CRM V1 search + typed filters.

        Filters are applied on `_base_query()` (company_id + soft-delete)
        *before* count/offset/limit so pagination never escapes the tenant.
        """
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        if status is not None:
            stmt = stmt.where(Customer.status == status)
        if owner_id is not None:
            # owner_id alone cannot broaden scope — company_id remains in stmt
            stmt = stmt.where(Customer.owner_id == owner_id)

        if search:
            term = search.strip()
            if len(term) > _MAX_SEARCH_LEN:
                raise ValidationError(
                    f"Search query must be at most {_MAX_SEARCH_LEN} characters."
                )
            if term:
                pattern = _ilike_contains(term)
                stmt = stmt.where(
                    or_(
                        Customer.company_name.ilike(pattern, escape="\\"),
                        Customer.email.ilike(pattern, escape="\\"),
                        Customer.phone.ilike(pattern, escape="\\"),
                        Customer.city.ilike(pattern, escape="\\"),
                    )
                )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total


class ContactRepository(BaseRepository[Contact]):
    model = Contact
    SORT_FIELDS = {
        "created_at": Contact.created_at,
        "last_name": Contact.last_name,
        "first_name": Contact.first_name,
    }


class LeadRepository(BaseRepository[Lead]):
    model = Lead
    SORT_FIELDS = {
        "created_at": Lead.created_at,
        "pipeline_stage": Lead.pipeline_stage,
        "expected_close_date": Lead.expected_close_date,
        "estimated_value": Lead.estimated_value,
    }


class DealRepository(BaseRepository[Deal]):
    model = Deal
    SORT_FIELDS = {
        "created_at": Deal.created_at,
        "value": Deal.value,
        "status": Deal.status,
    }

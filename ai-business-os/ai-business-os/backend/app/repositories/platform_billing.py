"""Authoritative access boundary for NexusOS platform billing state."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BillingProfileInvariantError
from app.models.payments import PlatformBillingProfile


class PlatformBillingProfileRepository:
    """Company-scoped lookup for the single authoritative billing profile."""

    def __init__(self, db: AsyncSession, *, company_id: uuid.UUID) -> None:
        self.db = db
        self.company_id = company_id

    async def get_authoritative(self) -> PlatformBillingProfile:
        profile = (
            await self.db.execute(
                select(PlatformBillingProfile).where(
                    PlatformBillingProfile.company_id == self.company_id
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            raise BillingProfileInvariantError()
        return profile

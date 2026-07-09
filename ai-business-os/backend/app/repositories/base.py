"""Generic tenant-scoped repository.

This is where the non-negotiable rule lives:
    "No company can ever access another company's data."

Every query built here automatically filters by company_id when the model
is tenant-owned, and excludes soft-deleted rows. Feature repositories
inherit from this and never write raw unscoped queries.
"""
import uuid
from typing import Generic, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, TenantIsolationError
from app.models.base import AuditedByMixin, Base, SoftDeleteMixin, TenantMixin

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    def __init__(
        self,
        db: AsyncSession,
        company_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id  # acting user — stamps created_by / updated_by

    # ------------------------------------------------------------------ #
    # Query building — tenant scoping happens here, once, for everything #
    # ------------------------------------------------------------------ #
    def _base_query(self) -> Select:
        stmt = select(self.model)

        if issubclass(self.model, TenantMixin):
            if self.company_id is None:
                # A tenant model queried without tenant context is a bug,
                # never a feature. Fail closed.
                raise TenantIsolationError(
                    details={"model": self.model.__name__}
                )
            stmt = stmt.where(self.model.company_id == self.company_id)

        if issubclass(self.model, SoftDeleteMixin):
            stmt = stmt.where(self.model.deleted_at.is_(None))

        return stmt

    # ------------------------------------------------------------------ #
    # CRUD                                                               #
    # ------------------------------------------------------------------ #
    async def get(self, entity_id: uuid.UUID) -> ModelT:
        stmt = self._base_query().where(self.model.id == entity_id)
        result = await self.db.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundError(f"{self.model.__name__} not found")
        return entity

    async def list(
        self,
        *,
        page: int = 1,
        page_size: int = 25,
        order_by=None,
    ) -> tuple[list[ModelT], int]:
        stmt = self._base_query()

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        if order_by is not None:
            stmt = stmt.order_by(order_by)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def create(self, entity: ModelT) -> ModelT:
        if issubclass(self.model, TenantMixin):
            if self.company_id is None:
                raise TenantIsolationError(details={"model": self.model.__name__})
            entity.company_id = self.company_id  # type: ignore[attr-defined]
        if issubclass(self.model, AuditedByMixin) and self.user_id is not None:
            entity.created_by = self.user_id  # type: ignore[attr-defined]
            entity.updated_by = self.user_id  # type: ignore[attr-defined]
        self.db.add(entity)
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def soft_delete(self, entity_id: uuid.UUID) -> None:
        entity = await self.get(entity_id)
        if isinstance(entity, SoftDeleteMixin):
            entity.deleted_at = func.now()
            await self.db.flush()
        else:
            await self.db.delete(entity)

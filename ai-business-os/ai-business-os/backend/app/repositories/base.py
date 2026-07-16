"""Generic tenant-scoped repository.

This is where the non-negotiable rule lives:
    "No company can ever access another company's data."

Every query built here automatically filters by company_id when the model
is tenant-owned, and excludes soft-deleted rows. Feature repositories
inherit from this and never write raw unscoped queries.

Hardening notes (Part 3.1):
  * Pagination is always bounded server-side — callers cannot request an
    unbounded page_size regardless of what a route forwards from a request.
  * Sorting is allowlisted per-model (`SORT_FIELDS`) — a client-controlled
    column name can never reach `ORDER BY` directly.
  * `create()`/`update()` never trust caller-supplied protected/security
    columns (company_id, id, created_by, deleted_at, …); those are always
    server-derived or explicitly rejected (fail closed, not silently
    dropped, so a caller notices a mass-assignment attempt immediately).
  * `restore()`/`list_deleted()` are tenant-scoped like everything else —
    a company can never see or resurrect another company's deleted rows.
"""
import uuid
from typing import Any, Generic, List, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.core.exceptions import NotFoundError, TenantIsolationError, ValidationError
from app.models.base import AuditedByMixin, Base, SoftDeleteMixin, TenantMixin

ModelT = TypeVar("ModelT", bound=Base)

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
MAX_BULK_IDS = 200

# Never assignable through update()/create() passthrough dicts. These are
# trusted, server-derived audit/tenancy/identity columns — a request body
# must never be able to set them, even by accident (e.g. `**payload.dict()`).
PROTECTED_FIELDS: frozenset[str] = frozenset(
    {"id", "company_id", "created_at", "created_by", "updated_at", "updated_by", "deleted_at"}
)


class BaseRepository(Generic[ModelT]):
    model: type[ModelT]

    # Allowlist mapping a public sort key -> real ORM column. Empty by
    # default so `list(sort_by=...)` fails closed unless a subclass opts in
    # specific columns — a client-supplied attribute name must never reach
    # `ORDER BY` unvalidated.
    SORT_FIELDS: dict[str, InstrumentedAttribute] = {}

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

    def _require_tenant_context(self) -> None:
        if issubclass(self.model, TenantMixin) and self.company_id is None:
            raise TenantIsolationError(details={"model": self.model.__name__})

    @classmethod
    def _clamp_pagination(cls, page: int, page_size: int) -> tuple[int, int]:
        page = max(int(page), 1)
        page_size = min(max(int(page_size), 1), MAX_PAGE_SIZE)
        return page, page_size

    def _safe_order_by(self, sort_by: str | None, sort_desc: bool = False):
        """Resolve a client-requested sort key through the model's allowlist.

        Never accepts a raw column/attribute name from the caller — unknown
        keys are rejected outright rather than silently ignored, so callers
        notice a bad/forged sort key instead of getting unsorted results.
        """
        if sort_by is None:
            return None
        column = self.SORT_FIELDS.get(sort_by)
        if column is None:
            raise ValidationError(f"Unknown sort field: {sort_by!r}")
        return column.desc() if sort_desc else column.asc()

    # ------------------------------------------------------------------ #
    # Reads                                                              #
    # ------------------------------------------------------------------ #
    async def get(self, entity_id: uuid.UUID) -> ModelT:
        stmt = self._base_query().where(self.model.id == entity_id)
        result = await self.db.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundError(f"{self.model.__name__} not found")
        return entity

    async def exists(self, entity_id: uuid.UUID) -> bool:
        stmt = select(self._base_query().where(self.model.id == entity_id).exists())
        result = await self.db.execute(stmt)
        return bool(result.scalar())

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self._base_query().subquery())
        return (await self.db.execute(stmt)).scalar_one()

    async def list(
        self,
        *,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        sort_by: str | None = None,
        sort_desc: bool = False,
        order_by=None,
    ) -> tuple[List[ModelT], int]:
        # NB: `typing.List` — PEP 649 (Python 3.14+) lazily builds this
        # class's `__annotate__` against its *final* namespace, where `list`
        # is this very method, not the builtin. Using bare `list[...]` here
        # would raise `TypeError: 'function' object is not subscriptable`
        # the moment anything introspects `__annotations__` (typing.get_type_hints,
        # some ORM/FastAPI/pydantic tooling, etc.) even though a plain
        # `import` never triggers it.
        page, page_size = self._clamp_pagination(page, page_size)
        stmt = self._base_query()

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        resolved_order = order_by if order_by is not None else self._safe_order_by(sort_by, sort_desc)
        if resolved_order is not None:
            stmt = stmt.order_by(resolved_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def list_deleted(
        self, *, page: int = 1, page_size: int = DEFAULT_PAGE_SIZE
    ) -> tuple[List[ModelT], int]:  # `List`, not `list` — see the `list()` method above
        """Tenant-scoped view of *only* soft-deleted rows (e.g. an admin
        "trash" screen). Still filters by company_id like every other query
        here — a company can never browse another company's deleted rows."""
        if not issubclass(self.model, SoftDeleteMixin):
            raise ValidationError(f"{self.model.__name__} does not support soft delete")
        self._require_tenant_context()
        page, page_size = self._clamp_pagination(page, page_size)

        stmt = select(self.model)
        if issubclass(self.model, TenantMixin):
            stmt = stmt.where(self.model.company_id == self.company_id)
        stmt = stmt.where(self.model.deleted_at.is_not(None))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(self.model.deleted_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def bulk_get(self, entity_ids: List[uuid.UUID]) -> List[ModelT]:  # noqa: UP006 — see list_deleted note
        """Tenant-scoped multi-fetch — e.g. validating a batch of referenced
        IDs before wiring up a relationship. Bounded so a single request
        can't force an unbounded `IN (...)` clause."""
        if not entity_ids:
            return []
        if len(entity_ids) > MAX_BULK_IDS:
            raise ValidationError(f"Cannot request more than {MAX_BULK_IDS} ids at once")
        stmt = self._base_query().where(self.model.id.in_(entity_ids))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------ #
    # Writes                                                             #
    # ------------------------------------------------------------------ #
    async def create(self, entity: ModelT) -> ModelT:
        if issubclass(self.model, TenantMixin):
            if self.company_id is None:
                raise TenantIsolationError(details={"model": self.model.__name__})
            # Always overwrite with the trusted context, never trust
            # whatever a caller may have set on the entity beforehand.
            entity.company_id = self.company_id  # type: ignore[attr-defined]
        if issubclass(self.model, AuditedByMixin) and self.user_id is not None:
            entity.created_by = self.user_id  # type: ignore[attr-defined]
            entity.updated_by = self.user_id  # type: ignore[attr-defined]
        self.db.add(entity)
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def update(self, entity_id: uuid.UUID, values: dict[str, Any]) -> ModelT:
        """Tenant-scoped partial update.

        The target row is resolved through `get()`, so a cross-tenant
        `entity_id` raises `NotFoundError` before any column is touched.
        Protected columns (company_id, id, created_by, deleted_at, …) can
        never be assigned this way — attempting to do so fails the whole
        call rather than being silently dropped, so mass-assignment attempts
        (e.g. a raw `payload.model_dump()`) are surfaced, not swallowed.
        """
        rejected = PROTECTED_FIELDS & values.keys()
        if rejected:
            raise ValidationError(
                f"Cannot assign protected field(s): {', '.join(sorted(rejected))}"
            )

        entity = await self.get(entity_id)  # fail-closed tenant-scoped fetch

        valid_columns = {c.key for c in self.model.__table__.columns}
        unknown = set(values.keys()) - valid_columns
        if unknown:
            raise ValidationError(f"Unknown field(s): {', '.join(sorted(unknown))}")

        for field, value in values.items():
            setattr(entity, field, value)

        if issubclass(self.model, AuditedByMixin) and self.user_id is not None:
            entity.updated_by = self.user_id  # type: ignore[attr-defined]

        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def soft_delete(self, entity_id: uuid.UUID) -> ModelT:
        """Soft delete only. Models without SoftDeleteMixin must use
        `hard_delete()` explicitly — this method never silently escalates to
        a permanent delete, so a caller can't lose data by mistake."""
        if not issubclass(self.model, SoftDeleteMixin):
            raise ValidationError(f"{self.model.__name__} does not support soft delete")
        entity = await self.get(entity_id)
        entity.deleted_at = func.now()  # type: ignore[attr-defined]
        if issubclass(self.model, AuditedByMixin) and self.user_id is not None:
            entity.updated_by = self.user_id  # type: ignore[attr-defined]
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def restore(self, entity_id: uuid.UUID) -> ModelT:
        """Undo a soft delete. Tenant-scoped like everything else: a company
        can never restore (or even discover the existence of) another
        company's deleted row."""
        if not issubclass(self.model, SoftDeleteMixin):
            raise ValidationError(f"{self.model.__name__} does not support restore")
        self._require_tenant_context()

        stmt = select(self.model).where(self.model.id == entity_id)
        if issubclass(self.model, TenantMixin):
            stmt = stmt.where(self.model.company_id == self.company_id)
        result = await self.db.execute(stmt)
        entity = result.scalar_one_or_none()
        if entity is None:
            raise NotFoundError(f"{self.model.__name__} not found")

        entity.deleted_at = None  # type: ignore[attr-defined]
        if issubclass(self.model, AuditedByMixin) and self.user_id is not None:
            entity.updated_by = self.user_id  # type: ignore[attr-defined]
        await self.db.flush()
        await self.db.refresh(entity)
        return entity

    async def hard_delete(self, entity_id: uuid.UUID) -> None:
        """Permanent delete. Deliberately a separate, explicitly-named call
        from `soft_delete()` — callers must opt in by name, since this is
        irreversible and normally only appropriate for non-soft-deletable
        auxiliary models (sessions, tokens, …), not primary business data."""
        entity = await self.get(entity_id)
        await self.db.delete(entity)
        await self.db.flush()

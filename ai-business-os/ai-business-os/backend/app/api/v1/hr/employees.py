"""Employees API — tenant-scoped HR CRUD (Part 07.2).

Router → EmployeeRepository. Scoped read authorization uses 07.1 helpers;
compensation is never implied by directory read. Soft archive only.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.hr import (
    ActiveUser,
    DbSession,
    EmployeeReadUser,
    EmployeeRepo,
    require_employee_read_access,
)
from app.hr.authorization import (
    EMPLOYEES_READ,
    EMPLOYEES_READ_SELF,
    EMPLOYEES_READ_TEAM,
    can_read_employee_record,
)
from app.models.enums import EmployeeStatus, EmploymentType
from app.models.hr import Employee
from app.models.user import User
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.hr import EmployeeRepository
from app.schemas.hr import (
    EmployeeCompensationResponse,
    EmployeeCreate,
    EmployeeResponse,
    EmployeeUpdate,
    employee_to_authorized_response,
    employee_to_response,
)
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/employees", tags=["HR Employees"])

_AUDIT_FIELDS = (
    "user_id",
    "first_name",
    "last_name",
    "work_email",
    "employee_number",
    "department",
    "manager_id",
    "hire_date",
    "employment_type",
    "status",
)


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


def _serialize_audit_value(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "value"):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _snapshot(employee: Employee, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(employee, name)) for name in fields}


async def _linked_users_by_id(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    employees: list[Employee],
) -> dict[uuid.UUID, User]:
    user_ids = {row.user_id for row in employees if row.user_id is not None}
    if not user_ids:
        return {}
    stmt = select(User).where(
        User.id.in_(user_ids),
        User.company_id == company_id,
        User.deleted_at.is_(None),
    )
    rows = (await db.execute(stmt)).scalars().all()
    return {user.id: user for user in rows}


def _serialize_for_list(
    employee: Employee,
    *,
    linked_users: dict[uuid.UUID, User],
) -> EmployeeResponse:
    linked = linked_users.get(employee.user_id) if employee.user_id else None
    return employee_to_response(employee, linked_user=linked)


def _serialize_for_detail(
    employee: Employee,
    *,
    permissions: frozenset[str],
    acting_user_id: uuid.UUID,
    linked_users: dict[uuid.UUID, User],
) -> EmployeeResponse | EmployeeCompensationResponse:
    linked = linked_users.get(employee.user_id) if employee.user_id else None
    return employee_to_authorized_response(
        employee,
        permissions=permissions,
        acting_user_id=acting_user_id,
        linked_user=linked,
    )


async def _resolve_visibility_scope(
    repo: EmployeeRepository,
    user: ActiveUser,
) -> tuple[uuid.UUID | None, uuid.UUID | None] | None:
    """Return visibility filters, or None when caller has company-wide read."""
    perms = user.permissions
    if EMPLOYEES_READ in perms:
        return None

    manager_employee_id: uuid.UUID | None = None
    if EMPLOYEES_READ_TEAM in perms:
        manager_employee_id = await repo.try_get_employee_id_for_user(user.id)

    acting_user_id = user.id if EMPLOYEES_READ_SELF in perms else None
    if manager_employee_id is None and acting_user_id is None:
        raise ForbiddenError()

    return manager_employee_id, acting_user_id


async def _assert_can_read_employee(
    employee: Employee,
    *,
    user: ActiveUser,
    repo: EmployeeRepository,
) -> None:
    caller_emp_id = await repo.try_get_employee_id_for_user(user.id)
    if not can_read_employee_record(
        permissions=user.permissions,
        acting_user_id=user.id,
        employee=employee,
        caller_employee_id=caller_emp_id,
    ):
        raise NotFoundError("Employee not found")


@router.get(
    "",
    dependencies=[Depends(require_employee_read_access())],
)
async def list_employees(
    repo: EmployeeRepo,
    user: EmployeeReadUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = False,
    search: Annotated[str | None, Query()] = None,
    status_filter: Annotated[
        EmployeeStatus | None, Query(alias="status")
    ] = None,
    employment_type_filter: Annotated[
        EmploymentType | None, Query(alias="employmentType")
    ] = None,
    manager_id: Annotated[uuid.UUID | None, Query(alias="managerId")] = None,
) -> ApiResponse[Paginated[EmployeeResponse]]:
    page, page_size = EmployeeRepository._clamp_pagination(page, page_size)
    visibility = await _resolve_visibility_scope(repo, user)

    list_kwargs: dict[str, Any] = {
        "page": page,
        "page_size": page_size,
        "sort_by": sort_by,
        "sort_desc": sort_desc,
        "search": search,
        "status": status_filter,
        "employment_type": employment_type_filter,
    }
    if visibility is not None:
        mgr_id, acting_id = visibility
        list_kwargs["visibility_manager_employee_id"] = mgr_id
        list_kwargs["visibility_user_id"] = acting_id
    if manager_id is not None and EMPLOYEES_READ in user.permissions:
        list_kwargs["manager_id"] = manager_id

    items, total = await repo.list_filtered(**list_kwargs)
    linked_users = await _linked_users_by_id(
        db, company_id=user.company_id, employees=items
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[
                _serialize_for_list(row, linked_users=linked_users)
                for row in items
            ],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("employees.create"))],
)
async def create_employee(
    payload: EmployeeCreate,
    repo: EmployeeRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[EmployeeResponse | EmployeeCompensationResponse]:
    data = payload.model_dump()
    user_id = data.get("user_id")
    EmployeeRepository.validate_identity_fields(
        user_id=user_id,
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
    )
    if user_id is not None:
        await repo.ensure_user_linkable(user_id)

    manager_id = data.get("manager_id")
    if manager_id is not None:
        await repo.ensure_manager_in_tenant(manager_id)

    try:
        created = await repo.create(Employee(**data))
    except IntegrityError as exc:
        await db.rollback()
        raise ValidationError("Employee number must be unique among active records.") from exc

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="employee.created",
        entity="employees",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    linked_users = await _linked_users_by_id(
        db, company_id=user.company_id, employees=[created]
    )
    return ApiResponse.ok(
        data=_serialize_for_list(created, linked_users=linked_users),
        message="Employee created.",
    )


@router.get(
    "/{employee_id}",
    dependencies=[Depends(require_employee_read_access())],
)
async def get_employee(
    employee_id: uuid.UUID,
    repo: EmployeeRepo,
    user: EmployeeReadUser,
    db: DbSession,
) -> ApiResponse[EmployeeResponse | EmployeeCompensationResponse]:
    employee = await repo.get(employee_id)
    await _assert_can_read_employee(employee, user=user, repo=repo)
    linked_users = await _linked_users_by_id(
        db, company_id=user.company_id, employees=[employee]
    )
    return ApiResponse.ok(
        data=_serialize_for_detail(
            employee,
            permissions=user.permissions,
            acting_user_id=user.id,
            linked_users=linked_users,
        )
    )


@router.patch(
    "/{employee_id}",
    dependencies=[Depends(require_permission("employees.update"))],
)
async def update_employee(
    employee_id: uuid.UUID,
    payload: EmployeeUpdate,
    repo: EmployeeRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[EmployeeResponse | EmployeeCompensationResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    existing = await repo.get(employee_id)

    merged_user_id = values["user_id"] if "user_id" in values else existing.user_id
    merged_first = values.get("first_name", existing.first_name)
    merged_last = values.get("last_name", existing.last_name)
    EmployeeRepository.validate_identity_fields(
        user_id=merged_user_id,
        first_name=merged_first,
        last_name=merged_last,
    )

    if "user_id" in values and values["user_id"] is not None:
        await repo.ensure_user_linkable(
            values["user_id"], exclude_employee_id=employee_id
        )

    if "manager_id" in values and values["manager_id"] is not None:
        await repo.ensure_manager_assignment_valid(
            employee_id, values["manager_id"]
        )

    changed_fields = list(values.keys())
    old_values = _snapshot(existing, changed_fields)
    updated = await repo.update(employee_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="employee.updated",
        entity="employees",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, changed_fields),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    linked_users = await _linked_users_by_id(
        db, company_id=user.company_id, employees=[updated]
    )
    return ApiResponse.ok(
        data=_serialize_for_list(updated, linked_users=linked_users),
        message="Employee updated.",
    )


@router.delete(
    "/{employee_id}",
    dependencies=[Depends(require_permission("employees.delete"))],
)
async def archive_employee(
    employee_id: uuid.UUID,
    repo: EmployeeRepo,
    user: ActiveUser,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(employee_id)
    snapshot = _snapshot(
        existing, ("employee_number", "status", "user_id", "department")
    )
    await repo.soft_delete(employee_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="employee.archived",
        entity="employees",
        entity_id=employee_id,
        old_values=snapshot,
        new_values={"archived": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Employee archived.")

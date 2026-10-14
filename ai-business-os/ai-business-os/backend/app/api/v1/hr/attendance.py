"""Attendance API — tenant-scoped clock in/out and corrections."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.exc import IntegrityError

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.hr import (
    ActiveUser,
    AttendanceReadUser,
    AttendanceRepo,
    DbSession,
    EmployeeRepo,
)
from app.hr.authorization import (
    ATTENDANCE_MANAGE,
    ATTENDANCE_READ,
    ATTENDANCE_READ_SELF,
    ATTENDANCE_READ_TEAM,
    can_read_attendance_for_employee,
)
from app.models.hr import Attendance
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.repositories.hr import AttendanceRepository
from app.schemas.hr import (
    AttendanceCreate,
    AttendanceResponse,
    AttendanceUpdate,
    attendance_to_response,
)
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/attendance", tags=["HR Attendance"])

_AUDIT_FIELDS = ("employee_id", "date", "clock_in", "clock_out", "hours_worked")


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    identity = resolve_client_identity(request)
    return identity.resolved_ip, request.headers.get("user-agent")


def _serialize_audit_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    return str(value)


def _snapshot(row: Attendance, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(row, name)) for name in fields}


async def _visibility_employee_ids(
    *,
    user: ActiveUser,
    employees: EmployeeRepo,
) -> list[uuid.UUID] | None:
    if ATTENDANCE_READ in user.permissions:
        return None

    ids: list[uuid.UUID] = []
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    if ATTENDANCE_READ_SELF in user.permissions and caller_id is not None:
        ids.append(caller_id)
    if ATTENDANCE_READ_TEAM in user.permissions and caller_id is not None:
        reports = await employees.list_direct_reports(caller_id)
        ids.extend(row.id for row in reports)
    return ids


async def _require_linked_employee(employees: EmployeeRepo, user: ActiveUser) -> uuid.UUID:
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    if caller_id is None:
        raise ValidationError("No employee record is linked to your user account.")
    return caller_id


@router.get("")
async def list_attendance(
    user: AttendanceReadUser,
    repo: AttendanceRepo,
    employees: EmployeeRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = True,
    employee_id: Annotated[uuid.UUID | None, Query(alias="employeeId")] = None,
    date_from: Annotated[date | None, Query(alias="dateFrom")] = None,
    date_to: Annotated[date | None, Query(alias="dateTo")] = None,
) -> ApiResponse[Paginated[AttendanceResponse]]:
    if date_from is not None and date_to is not None and date_from > date_to:
        raise ValidationError("dateFrom must be on or before dateTo.")

    visibility = await _visibility_employee_ids(user=user, employees=employees)
    if employee_id is not None and visibility is not None and employee_id not in visibility:
        raise ForbiddenError()

    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        employee_id=employee_id,
        date_from=date_from,
        date_to=date_to,
        visibility_employee_ids=visibility,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[attendance_to_response(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "/clock-in",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("attendance.clock"))],
)
async def clock_in(
    user: ActiveUser,
    repo: AttendanceRepo,
    employees: EmployeeRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[AttendanceResponse]:
    employee_id = await _require_linked_employee(employees, user)
    try:
        row = await repo.clock_in(employee_id)
    except IntegrityError:
        await db.rollback()
        raise ValidationError("Could not clock in. Try again.")

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="attendance.clock_in",
        entity="attendance",
        entity_id=row.id,
        new_values=_snapshot(row, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(data=attendance_to_response(row), message="Clocked in.")


@router.post(
    "/clock-out",
    dependencies=[Depends(require_permission("attendance.clock"))],
)
async def clock_out(
    user: ActiveUser,
    repo: AttendanceRepo,
    employees: EmployeeRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[AttendanceResponse]:
    employee_id = await _require_linked_employee(employees, user)
    old_row = await repo.get_for_employee_date(employee_id, date.today())
    old_values = _snapshot(old_row, _AUDIT_FIELDS) if old_row else None
    row = await repo.clock_out(employee_id)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="attendance.clock_out",
        entity="attendance",
        entity_id=row.id,
        old_values=old_values,
        new_values=_snapshot(row, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(data=attendance_to_response(row), message="Clocked out.")


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(ATTENDANCE_MANAGE))],
)
async def create_attendance(
    payload: AttendanceCreate,
    user: ActiveUser,
    repo: AttendanceRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[AttendanceResponse]:
    await repo.ensure_employee_in_tenant(payload.employee_id)
    values = payload.model_dump()
    if values.get("clock_in") and values.get("clock_out") and values.get("hours_worked") is None:
        values["hours_worked"] = AttendanceRepository.compute_hours(
            values["clock_in"], values["clock_out"]
        )
    try:
        created = await repo.create(Attendance(**values))
    except IntegrityError:
        await db.rollback()
        raise ValidationError(
            "Attendance already exists for this employee and date, or the reference is invalid."
        )

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="attendance.created",
        entity="attendance",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=attendance_to_response(created),
        message="Attendance recorded.",
    )


@router.get("/{attendance_id}")
async def get_attendance(
    attendance_id: uuid.UUID,
    user: AttendanceReadUser,
    repo: AttendanceRepo,
    employees: EmployeeRepo,
) -> ApiResponse[AttendanceResponse]:
    row = await repo.get(attendance_id)
    employee = await employees.get(row.employee_id)
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    if not can_read_attendance_for_employee(
        permissions=user.permissions,
        employee=employee,
        caller_employee_id=caller_id,
        acting_user_id=user.id,
    ):
        raise NotFoundError("Attendance not found")
    return ApiResponse.ok(data=attendance_to_response(row))


@router.patch(
    "/{attendance_id}",
    dependencies=[Depends(require_permission(ATTENDANCE_MANAGE))],
)
async def update_attendance(
    attendance_id: uuid.UUID,
    payload: AttendanceUpdate,
    user: ActiveUser,
    repo: AttendanceRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[AttendanceResponse]:
    values = payload.model_dump(exclude_unset=True)
    if not values:
        raise ValidationError("No fields to update.")

    existing = await repo.get(attendance_id)
    clock_in = values.get("clock_in", existing.clock_in)
    clock_out = values.get("clock_out", existing.clock_out)
    if clock_in and clock_out and "hours_worked" not in values:
        values["hours_worked"] = AttendanceRepository.compute_hours(clock_in, clock_out)

    old_values = _snapshot(existing, list(values.keys()))
    updated = await repo.update(attendance_id, values)

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="attendance.updated",
        entity="attendance",
        entity_id=updated.id,
        old_values=old_values,
        new_values=_snapshot(updated, list(values.keys())),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=attendance_to_response(updated),
        message="Attendance updated.",
    )


@router.delete(
    "/{attendance_id}",
    dependencies=[Depends(require_permission(ATTENDANCE_MANAGE))],
)
async def delete_attendance(
    attendance_id: uuid.UUID,
    user: ActiveUser,
    repo: AttendanceRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[None]:
    existing = await repo.get(attendance_id)
    await repo.soft_delete(attendance_id)
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="attendance.deleted",
        entity="attendance",
        entity_id=attendance_id,
        old_values=_snapshot(existing, _AUDIT_FIELDS),
        new_values={"deleted": True},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(message="Attendance deleted.")

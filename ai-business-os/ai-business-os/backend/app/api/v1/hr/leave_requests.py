"""Leave requests API — tenant-scoped HR leave workflow."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.exc import IntegrityError

from app.core.client_ip import resolve_client_identity
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationError
from app.dependencies.auth import require_permission
from app.dependencies.hr import (
    ActiveUser,
    DbSession,
    EmployeeRepo,
    LeaveReadUser,
    LeaveRepo,
)
from app.hr.authorization import (
    LEAVE_CREATE,
    LEAVE_READ,
    LEAVE_READ_SELF,
    LEAVE_READ_TEAM,
    can_approve_leave_for_employee,
    can_read_leave_for_employee,
)
from app.models.enums import ApprovalStatus, LeaveType
from app.models.hr import LeaveRequest
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.schemas.hr import (
    LeaveRequestCreate,
    LeaveRequestResponse,
    leave_request_to_response,
)
from app.schemas.response import ApiResponse, Paginated
from app.services import audit_service

router = APIRouter(prefix="/leave-requests", tags=["HR Leave"])

_AUDIT_FIELDS = (
    "employee_id",
    "leave_type",
    "start_date",
    "end_date",
    "reason",
    "approval_status",
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
    return str(value)


def _snapshot(row: LeaveRequest, fields: tuple[str, ...] | list[str]) -> dict[str, Any]:
    return {name: _serialize_audit_value(getattr(row, name)) for name in fields}


async def _visibility_employee_ids(
    *,
    user: ActiveUser,
    employees: EmployeeRepo,
) -> list[uuid.UUID] | None:
    """None = company-wide; otherwise restrict to visible employee ids."""
    if LEAVE_READ in user.permissions:
        return None

    ids: list[uuid.UUID] = []
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    if LEAVE_READ_SELF in user.permissions and caller_id is not None:
        ids.append(caller_id)
    if LEAVE_READ_TEAM in user.permissions and caller_id is not None:
        reports = await employees.list_direct_reports(caller_id)
        ids.extend(row.id for row in reports)
    return ids


@router.get("")
async def list_leave_requests(
    user: LeaveReadUser,
    repo: LeaveRepo,
    employees: EmployeeRepo,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")
    ] = DEFAULT_PAGE_SIZE,
    sort_by: Annotated[str | None, Query(alias="sortBy")] = None,
    sort_desc: Annotated[bool, Query(alias="sortDesc")] = True,
    employee_id: Annotated[uuid.UUID | None, Query(alias="employeeId")] = None,
    approval_status: Annotated[
        ApprovalStatus | None, Query(alias="approvalStatus")
    ] = None,
    leave_type: Annotated[LeaveType | None, Query(alias="leaveType")] = None,
) -> ApiResponse[Paginated[LeaveRequestResponse]]:
    visibility = await _visibility_employee_ids(user=user, employees=employees)
    if employee_id is not None and visibility is not None and employee_id not in visibility:
        raise ForbiddenError()

    items, total = await repo.list_filtered(
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_desc=sort_desc,
        employee_id=employee_id,
        approval_status=approval_status,
        leave_type=leave_type,
        visibility_employee_ids=visibility,
    )
    return ApiResponse.ok(
        data=Paginated.build(
            items=[leave_request_to_response(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(LEAVE_CREATE))],
)
async def create_leave_request(
    payload: LeaveRequestCreate,
    user: ActiveUser,
    repo: LeaveRepo,
    employees: EmployeeRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[LeaveRequestResponse]:
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    target_id = payload.employee_id
    if target_id is None:
        if caller_id is None:
            raise ValidationError("No employee record is linked to your user account.")
        target_id = caller_id
    elif target_id != caller_id and LEAVE_READ not in user.permissions:
        raise ForbiddenError("You can only create leave requests for yourself.")

    employee = await repo.ensure_employee_in_tenant(target_id)
    repo.validate_dates(payload.start_date, payload.end_date)

    try:
        created = await repo.create(
            LeaveRequest(
                employee_id=employee.id,
                leave_type=payload.leave_type,
                start_date=payload.start_date,
                end_date=payload.end_date,
                reason=payload.reason,
                approval_status=ApprovalStatus.PENDING,
            )
        )
    except IntegrityError:
        await db.rollback()
        raise ValidationError("Could not create leave request.")

    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="leave_request.created",
        entity="leave_requests",
        entity_id=created.id,
        new_values=_snapshot(created, _AUDIT_FIELDS),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=leave_request_to_response(created),
        message="Leave request submitted.",
    )


@router.get("/{leave_id}")
async def get_leave_request(
    leave_id: uuid.UUID,
    user: LeaveReadUser,
    repo: LeaveRepo,
    employees: EmployeeRepo,
) -> ApiResponse[LeaveRequestResponse]:
    leave = await repo.get(leave_id)
    employee = await employees.get(leave.employee_id)
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    if not can_read_leave_for_employee(
        permissions=user.permissions,
        employee=employee,
        caller_employee_id=caller_id,
        acting_user_id=user.id,
    ):
        raise NotFoundError("Leave request not found")
    return ApiResponse.ok(data=leave_request_to_response(leave))


async def _decide(
    *,
    leave_id: uuid.UUID,
    decision: ApprovalStatus,
    user: ActiveUser,
    repo: LeaveRepo,
    employees: EmployeeRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[LeaveRequestResponse]:
    leave = await repo.get(leave_id)
    employee = await employees.get(leave.employee_id)
    caller_id = await employees.try_get_employee_id_for_user(user.id)
    if not can_approve_leave_for_employee(
        permissions=user.permissions,
        employee=employee,
        caller_employee_id=caller_id,
    ):
        raise ForbiddenError()

    old = _snapshot(leave, ("approval_status",))
    updated = await repo.set_approval_status(leave_id, decision)
    ip_address, user_agent = _client_meta(request)
    await audit_service.record(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action=f"leave_request.{decision.value}",
        entity="leave_requests",
        entity_id=updated.id,
        old_values=old,
        new_values=_snapshot(updated, ("approval_status",)),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return ApiResponse.ok(
        data=leave_request_to_response(updated),
        message=f"Leave request {decision.value}.",
    )


@router.post(
    "/{leave_id}/approve",
    dependencies=[Depends(require_permission("leave_requests.approve"))],
)
async def approve_leave_request(
    leave_id: uuid.UUID,
    user: ActiveUser,
    repo: LeaveRepo,
    employees: EmployeeRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[LeaveRequestResponse]:
    return await _decide(
        leave_id=leave_id,
        decision=ApprovalStatus.APPROVED,
        user=user,
        repo=repo,
        employees=employees,
        db=db,
        request=request,
    )


@router.post(
    "/{leave_id}/reject",
    dependencies=[Depends(require_permission("leave_requests.approve"))],
)
async def reject_leave_request(
    leave_id: uuid.UUID,
    user: ActiveUser,
    repo: LeaveRepo,
    employees: EmployeeRepo,
    db: DbSession,
    request: Request,
) -> ApiResponse[LeaveRequestResponse]:
    return await _decide(
        leave_id=leave_id,
        decision=ApprovalStatus.REJECTED,
        user=user,
        repo=repo,
        employees=employees,
        db=db,
        request=request,
    )

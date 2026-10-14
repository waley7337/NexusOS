"""HR RBAC seed matrix — Part 07.1 employees permissions."""
from app.db.seed import DEFAULT_ROLES, expand


def test_employee_v1_permission_count_is_seven():
    names = [p for p in expand("*") if p.startswith("employees.")]
    assert len(names) == 7


def test_manager_has_team_and_self_not_compensation_or_company_read():
    names = expand(DEFAULT_ROLES["Manager"])
    assert "employees.read_team" in names
    assert "employees.read_self" in names
    assert "employees.read_compensation" not in names
    assert "employees.read" not in names
    assert "employees.create" not in names


def test_employee_role_has_read_self_only_for_hr():
    names = expand(DEFAULT_ROLES["Employee"])
    assert "employees.read_self" in names
    assert "employees.read_compensation" not in names
    assert "employees.read" not in names
    assert "employees.read_team" not in names


def test_viewer_has_no_hr_permissions():
    names = expand(DEFAULT_ROLES["Viewer"])
    assert not any(name.startswith("employees.") for name in names)


def test_owner_includes_all_employee_permissions():
    names = expand(DEFAULT_ROLES["Owner"])
    for perm in (
        "employees.read",
        "employees.read_compensation",
        "employees.read_self",
        "employees.read_team",
        "employees.create",
        "employees.update",
        "employees.delete",
    ):
        assert perm in names


def test_admin_includes_all_employee_permissions():
    names = expand(DEFAULT_ROLES["Admin"])
    assert "employees.read_compensation" in names
    assert "employees.delete" in names


def test_legacy_hr_permissions_not_in_catalog():
    names = expand("*")
    assert "hr.read" not in names
    assert "hr.manage" not in names


def test_leave_and_attendance_permissions_in_catalog():
    names = expand("*")
    for perm in (
        "leave_requests.read",
        "leave_requests.read_self",
        "leave_requests.read_team",
        "leave_requests.create",
        "leave_requests.approve",
        "attendance.read",
        "attendance.read_self",
        "attendance.read_team",
        "attendance.clock",
        "attendance.manage",
    ):
        assert perm in names


def test_manager_leave_attendance_grants_exclude_company_wide_manage():
    names = expand(DEFAULT_ROLES["Manager"])
    assert "leave_requests.read_team" in names
    assert "leave_requests.approve" in names
    assert "leave_requests.create" in names
    assert "leave_requests.read" not in names
    assert "attendance.read_team" in names
    assert "attendance.clock" in names
    assert "attendance.manage" not in names
    assert "attendance.read" not in names


def test_employee_leave_attendance_self_only():
    names = expand(DEFAULT_ROLES["Employee"])
    assert "leave_requests.read_self" in names
    assert "leave_requests.create" in names
    assert "leave_requests.approve" not in names
    assert "attendance.read_self" in names
    assert "attendance.clock" in names
    assert "attendance.manage" not in names

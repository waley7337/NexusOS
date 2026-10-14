"""Part 08.1 Finance RBAC seed matrix."""
from app.db.seed import DEFAULT_ROLES, expand


def test_finance_permission_modules_present():
    names = expand("*")
    for perm in (
        "payments.read",
        "payments.create",
        "payments.refund",
        "expenses.read",
        "expenses.create",
        "expenses.update",
        "expenses.delete",
        "payment_providers.read",
        "payment_providers.manage",
    ):
        assert perm in names


def test_manager_has_finance_view_and_invoice_read_only():
    names = expand(DEFAULT_ROLES["Manager"])
    assert "finance.view" in names
    assert "invoices.read" in names
    assert "payments.read" not in names
    assert "payments.create" not in names
    assert "payments.refund" not in names
    assert "payment_providers.read" not in names
    assert "payment_providers.manage" not in names
    # Intentional: Managers do not automatically receive expenses.* (Stripe work must not change this).
    assert "expenses.read" not in names
    assert "expenses.create" not in names
    assert "expenses.update" not in names
    assert "expenses.delete" not in names


def test_employee_has_no_finance_permissions():
    names = expand(DEFAULT_ROLES["Employee"])
    assert not any(
        name.startswith(("finance.", "invoices.", "payments.", "expenses.", "payment_providers."))
        for name in names
    )


def test_viewer_has_no_finance_permissions():
    names = expand(DEFAULT_ROLES["Viewer"])
    assert not any(
        name.startswith(("finance.", "invoices.", "payments.", "expenses.", "payment_providers."))
        for name in names
    )


def test_owner_includes_all_finance_permissions():
    names = expand(DEFAULT_ROLES["Owner"])
    for perm in (
        "finance.manage",
        "invoices.send",
        "payments.refund",
        "payment_providers.manage",
        "expenses.delete",
    ):
        assert perm in names

"""Part 06.1 — CRM backend foundation tests.

No operational CRUD endpoint tests here (those belong to 06.2).
"""

from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.api.v1.crm import router as crm_router
from app.api.v1.router import api_router
from app.core.exceptions import ValidationError
from app.models.crm import Contact, Customer, Deal, Lead
from app.models.enums import CustomerStatus, DealStatus, PipelineStage
from app.repositories.crm import (
    ContactRepository,
    CustomerRepository,
    DealRepository,
    LeadRepository,
)
from app.schemas.crm import (
    ContactCreate,
    ContactUpdate,
    CustomerCreate,
    CustomerUpdate,
    DealCreate,
    DealUpdate,
    LeadCreate,
    LeadUpdate,
)


PROTECTED = ("company_id", "created_by", "updated_by", "deleted_at", "id")


@pytest.mark.parametrize(
    ("repo_cls", "model"),
    [
        (CustomerRepository, Customer),
        (ContactRepository, Contact),
        (LeadRepository, Lead),
        (DealRepository, Deal),
    ],
)
def test_repository_model_binding(repo_cls, model):
    assert repo_cls.model is model
    assert isinstance(repo_cls.SORT_FIELDS, dict)
    assert repo_cls.SORT_FIELDS


def test_customer_sort_allowlist_matches_plan():
    assert set(CustomerRepository.SORT_FIELDS) == {
        "created_at",
        "company_name",
        "status",
    }


def test_contact_sort_allowlist_matches_plan():
    assert set(ContactRepository.SORT_FIELDS) == {
        "created_at",
        "last_name",
        "first_name",
    }


def test_lead_sort_allowlist_matches_plan():
    assert set(LeadRepository.SORT_FIELDS) == {
        "created_at",
        "pipeline_stage",
        "expected_close_date",
        "estimated_value",
    }


def test_deal_sort_allowlist_matches_plan():
    assert set(DealRepository.SORT_FIELDS) == {"created_at", "value", "status"}


@pytest.mark.asyncio
async def test_unknown_sort_field_rejected_by_base_repository():
    """SORT_FIELDS allowlist fails closed — no DB needed for this path."""
    class _FakeSession:
        pass

    repo = CustomerRepository(_FakeSession(), company_id=uuid.uuid4())  # type: ignore[arg-type]
    with pytest.raises(ValidationError, match="Unknown sort field"):
        repo._safe_order_by("not_a_real_column")


@pytest.mark.parametrize(
    "schema",
    [
        CustomerCreate,
        CustomerUpdate,
        ContactCreate,
        ContactUpdate,
        LeadCreate,
        LeadUpdate,
        DealCreate,
        DealUpdate,
    ],
)
def test_create_update_schemas_omit_protected_fields(schema):
    fields = set(schema.model_fields)
    for name in PROTECTED:
        assert name not in fields, f"{schema.__name__} must not accept {name}"


def test_customer_create_ignores_injected_protected_aliases():
    payload = CustomerCreate.model_validate(
        {
            "companyName": "Acme",
            "companyId": "11111111-1111-1111-1111-111111111111",
            "createdBy": "22222222-2222-2222-2222-222222222222",
            "updatedBy": "33333333-3333-3333-3333-333333333333",
            "deletedAt": "2026-01-01T00:00:00Z",
            "id": "44444444-4444-4444-4444-444444444444",
            "status": "active",
        }
    )
    assert payload.company_name == "Acme"
    assert payload.status is CustomerStatus.ACTIVE
    dumped = payload.model_dump()
    for name in PROTECTED:
        assert name not in dumped


def test_customer_create_rejects_invalid_status():
    with pytest.raises(PydanticValidationError):
        CustomerCreate.model_validate(
            {"companyName": "Acme", "status": "not-a-status"}
        )


def test_lead_create_defaults_pipeline_stage():
    payload = LeadCreate.model_validate(
        {"customerId": "11111111-1111-1111-1111-111111111111"}
    )
    assert payload.pipeline_stage is PipelineStage.NEW


def test_deal_create_normalizes_currency():
    payload = DealCreate.model_validate(
        {
            "leadId": "11111111-1111-1111-1111-111111111111",
            "value": "1000.00",
            "currency": "eur",
        }
    )
    assert payload.currency == "EUR"
    assert payload.status is DealStatus.OPEN


def test_crm_router_mounts_customers_and_contacts_only_so_far():
    """06.2+06.4: Customers and Contacts; Leads/Deals remain unmounted."""
    assert crm_router.prefix == "/crm"
    paths = [getattr(route, "path", "") for route in crm_router.routes]
    assert any("/customers" in p for p in paths)
    assert any("/contacts" in p for p in paths)
    assert not any("/leads" in p for p in paths)
    assert not any("/deals" in p for p in paths)

    api_paths = [getattr(route, "path", "") for route in api_router.routes]
    assert not any("/leads" in p for p in api_paths)
    assert not any("/deals" in p for p in api_paths)


def test_crm_package_exports_router():
    """CRM package must be importable and re-export the aggregate router."""
    from app.api.v1 import crm as crm_pkg

    assert crm_pkg.router is crm_router

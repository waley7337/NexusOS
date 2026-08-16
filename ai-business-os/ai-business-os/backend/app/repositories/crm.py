"""CRM repositories — thin BaseRepository subclasses.

Tenant scoping, soft-delete filtering, protected-field rejection, and
pagination/sort clamping all come from BaseRepository. These classes only
bind the ORM model and an explicit sort allowlist.
"""

from app.models.crm import Contact, Customer, Deal, Lead
from app.repositories.base import BaseRepository


class CustomerRepository(BaseRepository[Customer]):
    model = Customer
    SORT_FIELDS = {
        "created_at": Customer.created_at,
        "company_name": Customer.company_name,
        "status": Customer.status,
    }


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

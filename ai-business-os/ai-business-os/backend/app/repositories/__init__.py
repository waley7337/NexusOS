"""CRM repository exports."""

from app.repositories.crm import (
    ContactRepository,
    CustomerRepository,
    DealRepository,
    LeadRepository,
)

__all__ = [
    "CustomerRepository",
    "ContactRepository",
    "LeadRepository",
    "DealRepository",
]

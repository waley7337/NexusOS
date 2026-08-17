"""CRM repository exports."""

from app.repositories.crm import (
    ContactRepository,
    CustomerRepository,
    DealRepository,
    LeadRepository,
)
from app.repositories.hr import EmployeeRepository

__all__ = [
    "CustomerRepository",
    "ContactRepository",
    "LeadRepository",
    "DealRepository",
    "EmployeeRepository",
]

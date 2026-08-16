"""CRM API package — Part 06.1 foundation.

Sub-routers for customers/contacts/leads/deals land in 06.2+.
This package only mounts an empty CRM router so the module is importable
and wired into `/api/v1` without exposing incomplete endpoints.
"""

from app.api.v1.crm.router import router

__all__ = ["router"]

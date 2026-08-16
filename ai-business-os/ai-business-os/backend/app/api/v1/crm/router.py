"""CRM API router shell.

Part 06.1: no operational CRUD routes yet (those belong to 06.2+).
Sub-routers will be included here as Customers/Contacts/Leads/Deals ship.

Service-layer decision (06.1): simple CRM CRUD will use
router → repository (via dependencies.crm). Introduce CRM services only
when multi-step workflows appear (e.g. lead→deal conversion). Auth keeps
using services because registration/login are multi-step workflows.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/crm", tags=["CRM"])

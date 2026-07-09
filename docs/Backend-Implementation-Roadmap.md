# Backend Implementation Roadmap

## 1. Purpose

This document is the official backend-first implementation roadmap for the enterprise SaaS platform. It preserves the established architecture and implementation order while adding enterprise engineering standards for consistency, security, observability, testing, and delivery.

Companion standards:

- [Engineering Rules](./Engineering-Rules.md)
- [API Standards](./API-Standards.md)
- [Architecture Guidelines](./Architecture-Guidelines.md)
- [Error Code Catalog](./Error-Code-Catalog.md)
- [Performance Standards](./Performance-Standards.md)
- [Definition of Done](./Definition-of-Done.md)

## 2. Implementation Order

```text
Database
  -> Repositories
  -> Services
  -> Business Logic
  -> API Endpoints
  -> Tests
  -> Frontend
  -> Deployment
```

Frontend work must consume already-implemented and tested backend contracts.

## 3. Global Engineering Standards

All sections in this roadmap must comply with:

| Standard | Requirement |
| --- | --- |
| Layering | Routers contain no business logic; services own business logic; repositories access only the database |
| API responses | Every endpoint uses the standard success and error envelopes |
| Schemas | Every endpoint has request and response schemas |
| Transactions | Every write workflow documents transaction and rollback behavior |
| Domain events | Side effects use domain events rather than tight service coupling |
| CQRS | Separate query and command services where read/write complexity differs |
| Audit | Every write creates an audit event where appropriate |
| Tenancy | Every tenant-owned query scopes by `company_id` |
| Security | No hardcoded secrets; RBAC and tenant isolation enforced server-side |
| OpenAPI | Swagger documentation remains synchronized with implementation |
| Testing | Every module includes unit, integration, authorization, tenant, and workflow tests |
| Performance | Critical paths must meet measurable targets from the performance standard |

## 4. Universal API Response Standard

Success:

```json
{
  "success": true,
  "message": "",
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "",
    "message": ""
  }
}
```

All business errors must use stable codes from the error-code catalog.

## 5. Roadmap Sections

Each implementation section contains:

- Objective.
- Features.
- Business Logic.
- Database Tables.
- Backend Services.
- API Endpoints.
- Validation Rules.
- Security Requirements.
- Acceptance Criteria.
- Dependencies.
- Testing Requirements.

---

## 3.1 Backend Foundation

### Objective

Establish the FastAPI backend architecture, async database infrastructure, repository/service foundation, configuration, logging, error handling, domain-event infrastructure, background-job foundation, and test framework.

### Features

| Feature | Description |
| --- | --- |
| FastAPI application factory | Configurable app creation for local, test, staging, and production |
| Async SQLAlchemy | SQLAlchemy 2.0 async sessions with PostgreSQL 17 |
| Repository base | Tenant-aware CRUD, soft-delete, pagination, filtering, and sorting helpers |
| Service base | Transaction-aware business service conventions |
| Domain event bus | In-process foundation with queue-ready event contracts |
| Background job adapter | Celery + Redis or chosen queue abstraction |
| Settings | Pydantic v2 configuration with environment validation |
| Errors | Standard error envelope and error-code mapping |
| Logging | Structured request and error logs |
| Test foundation | Async pytest, factories, test database, migration test hooks |

### Business Logic

- Services own transaction boundaries.
- Repositories apply tenant scope for tenant-owned tables.
- Domain events are recorded during transactions and dispatched after commit.
- External side effects are queued after successful commit.
- Test engines must avoid event-loop-bound global asyncpg pools.

### Database Tables

`companies`, `users`, `roles`, `permissions`, `user_roles`, `audit_logs`.

### Backend Services

`DatabaseSessionManager`, `BaseRepository`, `BaseService`, `AuditService`, `EventService`, `BackgroundJobService`, `HealthService`, `RequestContextService`.

### API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Application health |
| `GET` | `/api/v1/health/database` | Database readiness |
| `GET` | `/api/v1/app/config` | Frontend-safe runtime config |
| `GET` | `/api/v1/me` | Current user context |

### Validation Rules

- UUIDs must be valid.
- Pagination and sorting must follow API standards.
- Environment configuration must be validated at startup.
- Request context must exist for authenticated routes.

### Security Requirements

- No secrets in source code.
- No stack traces in API responses.
- Tenant context must not be trusted from arbitrary client input.
- Audit context must include request ID, user ID, and company ID where available.

### Acceptance Criteria

- App starts in all supported environments.
- Health endpoints work.
- Async sessions work reliably in tests.
- Repository and service base classes are usable by all modules.
- Standard response and error envelopes are implemented.
- Structured request logging works.

### Dependencies

PostgreSQL 17, Python 3.13+, FastAPI, SQLAlchemy 2.0, asyncpg, Alembic, Pydantic v2, pytest.

### Testing Requirements

Configuration tests, error mapping tests, async session tests, migration schema tests, health endpoint tests, asyncpg event-loop regression tests.

---

## 3.2 Authentication

### Objective

Implement secure authentication flows for workers, bosses/admins, and clients.

### Features

Login, logout, refresh-token rotation, forgot password, reset password, invitation acceptance, first-login password setup, session expiration handling, disabled account handling, multi-role context.

### Business Logic

- Passwords are securely hashed.
- Refresh tokens are hashed, rotated, and revocable.
- Reset and invitation tokens are single-use and time-limited.
- Disabled, inactive, or soft-deleted users cannot authenticate.
- Authentication events are audited.

### Transaction Boundary

```text
Login
  -> Validate credentials
  -> Revoke/rotate session where applicable
  -> Create refresh token
  -> Create audit event
  -> Commit
```

Invitation acceptance:

```text
Begin transaction
  -> Validate invitation token
  -> Create or activate user
  -> Assign role
  -> Mark invitation accepted
  -> Create audit event
  -> Emit ClientInvitedEvent or WorkerCreatedEvent where applicable
Commit
After commit
  -> Queue welcome email/notification
Rollback on any required failure
```

### Database Tables

`users`, `companies`, `roles`, `user_roles`, `refresh_tokens`, `password_reset_tokens`, `user_invitations`, `audit_logs`.

### Backend Services

`AuthService`, `PasswordService`, `TokenService`, `SessionService`, `InvitationService`, `AuditService`.

### API Endpoints

`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `GET /api/v1/auth/invitations/{token}`, `POST /api/v1/auth/invitations/{token}/accept`, `PATCH /api/v1/me/password`.

### Validation Rules

Valid normalized email, password policy, valid token format, unexpired unused tokens, password confirmation where required.

### Security Requirements

Generic failed-login messages, short-lived access tokens, refresh-token reuse detection, hashed tokens at rest, secure cookies or headers, audited auth events.

### Acceptance Criteria

Valid users authenticate, invalid credentials fail safely, refresh rotation works, logout revokes session, password reset works, invitation acceptance works, current user returns roles and permissions.

### Dependencies

Backend foundation, user table, company table, RBAC seed data, email adapter or stub.

### Testing Requirements

Password tests, token tests, login/refresh/logout tests, reset tests, invitation tests, disabled user tests, audit tests.

---

## 3.3 RBAC

### Objective

Implement backend-enforced permissions for routes, services, and business workflows.

### Features

Permission catalog, default roles, custom company roles, role assignment, effective permission resolution, route enforcement, service enforcement, access-denied responses.

### Business Logic

System permissions cannot be modified; system roles cannot be deleted; role names are unique per company; users cannot remove their own final admin role; backend enforcement is authoritative.

### Transaction Boundary

```text
Assign Roles
  -> Validate admin permission
  -> Validate target user company
  -> Validate roles
  -> Replace role assignments
  -> Create audit event
  -> Emit UserRolesChangedEvent
  -> Commit
```

### Database Tables

`users`, `companies`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`.

### Backend Services

`PermissionService`, `RoleService`, `UserRoleService`, `AuthorizationService`, `AuditService`.

### API Endpoints

`GET /api/v1/rbac/roles`, `POST /api/v1/rbac/roles`, `GET /api/v1/rbac/roles/{role_id}`, `PATCH /api/v1/rbac/roles/{role_id}`, `DELETE /api/v1/rbac/roles/{role_id}`, `GET /api/v1/rbac/permissions`, `GET /api/v1/users/{user_id}/roles`, `PUT /api/v1/users/{user_id}/roles`, `GET /api/v1/me/permissions`.

### Validation Rules

Role name required and unique per company; permission IDs must exist; system role deletion invalid; cross-tenant role assignment invalid.

### Security Requirements

RBAC endpoints require admin permissions; service-level permission checks required; authorization failures return standard `403`; mutations audited.

### Acceptance Criteria

Effective permissions are correct, unauthorized access is denied, admins manage custom roles, default roles are protected, privilege escalation is blocked.

### Dependencies

Authentication, permission catalog, default roles, tenant context.

### Testing Requirements

Permission resolution, role CRUD, assignment, protected endpoint tests, tenant isolation, audit tests.

---

## 3.4 Multi-Tenancy

### Objective

Ensure every tenant-owned workflow is isolated by `company_id`.

### Features

Tenant context, tenant-scoped repositories, tenant-safe services, tenant-level uniqueness, cross-tenant access protection, tenant-aware audit logs.

### Business Logic

Tenant-owned records include `company_id`; reads filter by authenticated company; creates assign company context; cross-tenant foreign keys are rejected; soft-deleted records are excluded by default.

### Database Tables

All tenant-owned tables, including `companies`, `users`, `roles`, `projects`, `worker_profiles`, `client_profiles`, `time_entries`, `progress_updates`, `issues`, `messages`, `notifications`, `file_uploads`, `audit_logs`.

### Backend Services

`TenantContextService`, `TenantPolicyService`, tenant-aware repositories, `AuditService`.

### API Endpoints

Tenant enforcement applies to all protected endpoints.

### Validation Rules

Company context is required; cross-tenant references invalid; tenant-scoped unique fields unique per company.

### Security Requirements

Do not trust client-supplied company IDs; log security-relevant cross-tenant attempts; test representative workflows.

### Acceptance Criteria

No cross-tenant reads or writes; same-company relationships enforced; audit logs include tenant context.

### Dependencies

Backend foundation, authentication, RBAC, schema with `company_id`.

### Testing Requirements

Read/write isolation, cross-tenant relationship tests, unique constraint tests, soft-delete tests, repository scope tests.

---

## 3.5 User Management

### Objective

Implement user lifecycle workflows for admins, workers, and clients.

### Features

User list/detail, invitations, updates, disable/reactivate, role assignment, profile linkage, session revocation on disable.

### Business Logic

Emails follow identity uniqueness rules; user creation assigns tenant context; disabling revokes sessions; users cannot self-remove final admin access.

### Transaction Boundary

```text
Create User
  -> Validate permission and tenant
  -> Create user
  -> Assign roles
  -> Create invitation if needed
  -> Create audit event
  -> Emit UserCreatedEvent
  -> Commit
After commit: queue invitation email
```

### Database Tables

`users`, `companies`, `roles`, `user_roles`, `worker_profiles`, `client_profiles`, `user_invitations`, `refresh_tokens`, `audit_logs`.

### Backend Services

`UserService`, `InvitationService`, `UserRoleService`, `SessionService`, `AuditService`.

### API Endpoints

`GET /api/v1/users`, `POST /api/v1/users/invitations`, `GET /api/v1/users/{user_id}`, `PATCH /api/v1/users/{user_id}`, `POST /api/v1/users/{user_id}/disable`, `POST /api/v1/users/{user_id}/reactivate`, role endpoints from RBAC.

### Validation Rules

Valid email, valid names, valid status transitions, valid role IDs, cannot disable final admin.

### Security Requirements

Admin permission required; self-profile updates restricted; cross-tenant access blocked; lifecycle changes audited.

### Acceptance Criteria

Admins can list, invite, update, disable, reactivate, and assign roles; disabled users cannot log in; user data tenant-isolated.

### Dependencies

Authentication, RBAC, multi-tenancy.

### Testing Requirements

CRUD, invitation, disable/reactivate, role assignment, tenant isolation, audit tests.

---

## 3.6 Company Management

### Objective

Implement company profile, settings, operational policies, timezone, locale, and tenant status management.

### Features

Company profile, company settings, attendance policies, file policies, notification policies, active/suspended status support.

### Business Logic

Company timezone controls date boundaries; suspended companies cannot perform normal mutations; downstream services consume settings consistently.

### Database Tables

`companies`, `company_settings`, `users`, `audit_logs`.

### Backend Services

`CompanyService`, `CompanySettingsService`, `TenantContextService`, `AuditService`.

### API Endpoints

`GET /api/v1/company`, `PATCH /api/v1/company`, `GET /api/v1/company/settings`, `PATCH /api/v1/company/settings`.

### Validation Rules

Company name required; timezone must be valid IANA; locale supported; file limits within platform maximums; policies use approved values.

### Security Requirements

Company updates require admin permissions; sensitive setting changes require elevated permissions; changes audited.

### Acceptance Criteria

Admins can manage company profile/settings; invalid policies rejected; timezone available to workflows.

### Dependencies

Authentication, RBAC, multi-tenancy.

### Testing Requirements

Profile/settings tests, timezone validation, authorization, audit tests.

---

## 3.7 Worker Management

### Objective

Implement worker profiles and worker-specific administrative workflows.

### Features

Worker list/detail, create/update profile, status management, assignment readiness, worker documents, worker dashboard.

### Business Logic

Worker profile links to same-company user; inactive workers cannot receive new assignments; worker dashboard derives from assigned projects and activity.

### Transaction Boundary

Create worker follows the transaction documented in Architecture Guidelines.

### Database Tables

`worker_profiles`, `users`, `companies`, `project_assignments`, `time_entries`, `medical_certificates`, `payroll_slips`, `file_uploads`, `audit_logs`.

### Backend Services

`WorkerCommandService`, `WorkerQueryService`, `WorkerDashboardService`, `ProjectAssignmentService`, `DocumentService`, `AuditService`.

### API Endpoints

`GET /api/v1/workers`, `POST /api/v1/workers`, `GET /api/v1/workers/{worker_id}`, `PATCH /api/v1/workers/{worker_id}`, `GET /api/v1/workers/{worker_id}/assignments`, `GET /api/v1/workers/{worker_id}/documents`, `GET /api/v1/worker/dashboard`, `GET /api/v1/worker/assignments`.

### Validation Rules

Same-company user required; one profile per user; valid status transitions; document permissions enforced.

### Security Requirements

Workers access own dashboard; admins manage workers with permission; payroll/medical documents require explicit permissions; changes audited.

### Acceptance Criteria

Admins manage workers; workers view assigned projects and dashboard; inactive workers blocked from new assignments; tenant isolation enforced.

### Dependencies

User management, RBAC, multi-tenancy, file foundation.

### Testing Requirements

Worker CRUD, dashboard, authorization, tenant isolation, document visibility tests.

---

## 3.8 Client Management

### Objective

Implement client profiles, client project linkage, and restricted client portal data access.

### Features

Client list/detail, create/update profile, project linking, client dashboard, client visibility controls for progress, issues, files, and messages.

### Business Logic

Clients access only explicitly linked projects; client-visible data must be approved; internal notes and internal-only messages/files are never exposed.

### Database Tables

`client_profiles`, `users`, `companies`, `projects`, `project_clients`, `progress_updates`, `issues`, `file_uploads`, `message_threads`, `messages`, `notifications`, `audit_logs`.

### Backend Services

`ClientCommandService`, `ClientQueryService`, `ClientPortalService`, `ProjectClientService`, `ClientVisibilityService`, `AuditService`.

### API Endpoints

`GET /api/v1/clients`, `POST /api/v1/clients`, `GET /api/v1/clients/{client_id}`, `PATCH /api/v1/clients/{client_id}`, `GET /api/v1/client/dashboard`, `GET /api/v1/client/projects`, `GET /api/v1/client/projects/{project_id}`, `GET /api/v1/client/projects/{project_id}/progress`, `GET /api/v1/client/projects/{project_id}/issues`, `GET /api/v1/client/projects/{project_id}/files`, `GET /api/v1/client/messages`, `POST /api/v1/client/messages`.

### Validation Rules

Valid same-company user; project-client links same tenant; client-visible flags require permission.

### Security Requirements

Client role required for portal; project linkage enforced; internal data hidden; changes audited.

### Acceptance Criteria

Admins manage clients; clients view only authorized project data; client portal supports projects, progress, files, issues, messaging, notifications.

### Dependencies

User management, RBAC, multi-tenancy, project management.

### Testing Requirements

Client CRUD, portal authorization, project linkage, visibility, tenant isolation tests.

---

## 3.9 Project Management

### Objective

Implement project lifecycle, assignments, client links, status workflow, files, progress history, issue history, and archive behavior.

### Features

Project list/create/edit/detail, worker assignment, client assignment, status management, timeline, files, progress history, issue history, archive project.

### Business Logic

Projects are tenant-scoped; assignments must be same-company and active; status transitions follow workflow; archived projects cannot receive updates unless reopened.

### Database Tables

`projects`, `project_assignments`, `project_clients`, `users`, `worker_profiles`, `client_profiles`, `progress_updates`, `issues`, `project_files`, `file_uploads`, `audit_logs`.

### Backend Services

`ProjectCommandService`, `ProjectQueryService`, `ProjectAssignmentService`, `ProjectClientService`, `ProjectTimelineService`, `ProjectFileService`, `AuditService`.

### API Endpoints

`GET /api/v1/projects`, `POST /api/v1/projects`, `GET /api/v1/projects/{project_id}`, `PATCH /api/v1/projects/{project_id}`, `DELETE /api/v1/projects/{project_id}`, `GET /api/v1/projects/{project_id}/assignments`, `PUT /api/v1/projects/{project_id}/assignments`, `GET /api/v1/projects/{project_id}/clients`, `PUT /api/v1/projects/{project_id}/clients`, `GET /api/v1/projects/{project_id}/progress`, `GET /api/v1/projects/{project_id}/issues`, `GET /api/v1/projects/{project_id}/files`.

### Validation Rules

Name required; valid date range; valid enum status; same-company workers/clients; archived project rules enforced.

### Security Requirements

Admins manage projects; workers view assigned projects; clients view linked approved project data; changes audited.

### Acceptance Criteria

Admins manage projects/assignments; workers and clients see appropriate views; search/filter/sort/pagination work; status changes audited.

### Dependencies

User, worker, client, RBAC, multi-tenancy.

### Testing Requirements

CRUD, assignment, client-link, status transition, archive/delete, tenant isolation, audit tests.

---

## 3.10 Attendance: Check-In / Check-Out

### Objective

Implement daily check-in/check-out attendance with admin oversight and correction workflows.

### Features

Check-in, check-out, current status, history, project selection, location capture, notes, missing check-out detection, manual correction, correction approval.

### Business Logic

No duplicate open check-ins; cannot check out without active check-in; checkout after checkin; project must be assigned when required; company timezone controls daily boundaries.

### Transaction Boundary

Check-in and check-out transactions are defined in Architecture Guidelines.

### Database Tables

`time_entries`, `attendance_corrections`, `users`, `worker_profiles`, `projects`, `project_assignments`, `audit_logs`.

### Backend Services

`AttendanceCommandService`, `AttendanceQueryService`, `AttendanceCorrectionService`, `TimeCalculationService`, `ProjectAssignmentService`, `AuditService`, `NotificationService`.

### API Endpoints

`GET /api/v1/time-entries/today`, `POST /api/v1/time-entries/check-in`, `POST /api/v1/time-entries/check-out`, `GET /api/v1/time-entries`, `GET /api/v1/admin/time-entries`, `PATCH /api/v1/admin/time-entries/{time_entry_id}`, `POST /api/v1/admin/time-entries/{time_entry_id}/approve-correction`.

### Validation Rules

Active worker required; valid project assignment; valid timestamps; correction reason required; location shape validated.

### Security Requirements

Workers manage own attendance; admins require permission; corrections audited; tenant isolation enforced.

### Acceptance Criteria

Check-in/out works; invalid states blocked; admins review and correct; missing check-outs detected; audit logs created.

### Dependencies

Worker management, project management, notifications.

### Testing Requirements

State tests, duplicate tests, assignment tests, correction tests, timezone tests, tenant isolation, audit tests.

---

## 3.11 Time Tracking

### Objective

Implement time tracking review, approval, rejection, adjustment, summaries, and export-ready views.

### Features

Time entry list/detail, project-based tracking, daily/weekly totals, admin review, approval, rejection, adjustments, filtering, export-ready responses.

### Business Logic

Durations calculated server-side; no overlaps unless allowed; approved entries protected; rejection requires reason; workers cannot approve own entries.

### Database Tables

`time_entries`, `time_entry_reviews`, `users`, `worker_profiles`, `projects`, `project_assignments`, `audit_logs`.

### Backend Services

`TimeTrackingCommandService`, `TimeTrackingQueryService`, `TimeReviewService`, `TimeSummaryService`, `TimeCalculationService`, `AuditService`.

### API Endpoints

`GET /api/v1/time-entries`, `GET /api/v1/time-entries/{time_entry_id}`, `PATCH /api/v1/time-entries/{time_entry_id}`, `GET /api/v1/admin/time-entries`, `POST /api/v1/admin/time-entries/{time_entry_id}/approve`, `POST /api/v1/admin/time-entries/{time_entry_id}/reject`, `GET /api/v1/admin/time-entries/summary`.

### Validation Rules

Valid timestamp range; rejection reason required; approved entries require reopening before edit; filters allowlisted.

### Security Requirements

Workers see own entries; admins require time permissions; review actions audited; tenant isolation enforced.

### Acceptance Criteria

Workers view hours; admins approve/reject; summaries match raw data; approved entries protected.

### Dependencies

Attendance, workers, projects.

### Testing Requirements

List/detail, approval/rejection, overlap, summary, authorization, tenant tests.

---

## 3.12 Progress Updates

### Objective

Implement progress update submission, review, approval, rejection, attachments, client visibility, and timelines.

### Features

Create progress update, progress percentage, notes, file/photo attachments, admin review, client visibility, project timeline, worker history, client feed.

### Business Logic

Workers submit only for assigned active projects; percentage 0-100; client visibility requires permission; rejection requires reason; archived project rules apply.

### Database Tables

`progress_updates`, `progress_update_files`, `projects`, `project_assignments`, `users`, `file_uploads`, `notifications`, `audit_logs`.

### Backend Services

`ProgressCommandService`, `ProgressQueryService`, `ProgressReviewService`, `ClientVisibilityService`, `FileService`, `NotificationService`, `AuditService`.

### API Endpoints

`POST /api/v1/progress-updates`, `GET /api/v1/progress-updates`, `GET /api/v1/progress-updates/{progress_update_id}`, `PATCH /api/v1/progress-updates/{progress_update_id}`, `DELETE /api/v1/progress-updates/{progress_update_id}`, `POST /api/v1/progress-updates/{progress_update_id}/approve`, `POST /api/v1/progress-updates/{progress_update_id}/reject`, `GET /api/v1/projects/{project_id}/progress`.

### Validation Rules

Project required; percentage 0-100; notes length-bounded; rejection reason required; file rules enforced.

### Security Requirements

Assigned workers only; admin review permission; clients see approved client-visible updates; audit mutations.

### Acceptance Criteria

Workers submit; admins approve/reject; timelines update; client portal shows approved visible updates; attachments secure.

### Dependencies

Projects, workers, files, notifications.

### Testing Requirements

CRUD, approval/rejection, client visibility, attachments, authorization, tenant, audit tests.

---

## 3.13 Issue Reporting

### Objective

Implement issue reporting with photos, severity, status, assignment, comments, client visibility, resolution, and reopening.

### Features

Create issue, photo attachments, severity, status workflow, owner assignment, comments, client visibility, resolution, reopen, admin review.

### Business Logic

Workers report only assigned project issues; severity/status from enums; resolved issues require notes; reopened issues require reason; internal comments hidden from clients.

### Database Tables

`issues`, `issue_comments`, `issue_files`, `projects`, `project_assignments`, `users`, `file_uploads`, `notifications`, `audit_logs`.

### Backend Services

`IssueCommandService`, `IssueQueryService`, `IssueCommentService`, `IssueAssignmentService`, `IssueWorkflowService`, `ClientVisibilityService`, `FileService`, `NotificationService`, `AuditService`.

### API Endpoints

`POST /api/v1/issues`, `GET /api/v1/issues`, `GET /api/v1/issues/{issue_id}`, `PATCH /api/v1/issues/{issue_id}`, `DELETE /api/v1/issues/{issue_id}`, `POST /api/v1/issues/{issue_id}/comments`, `GET /api/v1/issues/{issue_id}/comments`, `POST /api/v1/issues/{issue_id}/files`, `POST /api/v1/issues/{issue_id}/resolve`, `POST /api/v1/issues/{issue_id}/reopen`.

### Validation Rules

Title/description/project required; severity approved; status transitions valid; resolution/reopen reasons required; photos meet file rules.

### Security Requirements

Assigned workers can report; admins manage; clients see only visible summaries; internal comments hidden; audit workflow changes.

### Acceptance Criteria

Workers report issues with photos; admins assign/update/resolve/reopen; comments work; client-visible issues appear; notifications fire.

### Dependencies

Projects, workers, clients, files, notifications.

### Testing Requirements

CRUD, attachments, comments, resolve/reopen, client visibility, authorization, tenant, audit tests.

---

## 3.14 File Management

### Objective

Implement secure upload, validation, metadata, visibility, review, preview/download, medical certificates, payroll slips, project files, issue photos, progress photos, and message attachments.

### Features

General upload, metadata, secure download, preview, deletion, medical certificates, payroll slips, project files, issue/progress photos, message attachments, client visibility, review workflow, virus-scan readiness.

### Business Logic

Validate MIME, extension, size, and business context; object storage abstracted; signed URLs or streaming; sensitive documents restricted; rejected files require reason.

### Transaction Boundary

File upload transaction is defined in Architecture Guidelines.

### Database Tables

`file_uploads`, `medical_certificates`, `payroll_slips`, `project_files`, `issue_files`, `progress_update_files`, `message_attachments`, `users`, `projects`, `audit_logs`.

### Backend Services

`FileService`, `StorageService`, `DocumentService`, `FileAccessPolicyService`, `FileReviewService`, `VirusScanJob`, `AuditService`.

### API Endpoints

`POST /api/v1/files`, `GET /api/v1/files/{file_id}`, `GET /api/v1/files/{file_id}/download`, `DELETE /api/v1/files/{file_id}`, `POST /api/v1/documents/medical-certificates`, `GET /api/v1/documents/medical-certificates`, `POST /api/v1/documents/payroll-slips`, `GET /api/v1/documents/payroll-slips`, `POST /api/v1/files/{file_id}/approve`, `POST /api/v1/files/{file_id}/reject`.

### Validation Rules

File required; MIME allowed; size within limits; extension matches detected type; context accessible; rejection reason required.

### Security Requirements

Permission check before every download; no raw storage keys; sensitive docs not client-visible; virus scan state tracked; file actions audited.

### Acceptance Criteria

Uploads work; invalid files rejected; files link to business records; payroll and medical documents remain private; client-shared files appear in portal.

### Dependencies

Company settings, storage backend, workflow modules.

### Testing Requirements

Upload validation, metadata, download auth, document visibility, review workflow, tenant, audit tests.

---

## 3.15 Messaging

### Objective

Implement secure tenant-scoped messaging for workers, admins, and clients.

### Features

Direct messages, project threads, client-company threads, participants, messages, read receipts, attachments, search, archive, notifications.

### Business Logic

Sender must be participant; participants same tenant or linked clients; project threads require accessible projects; clients cannot see internal threads.

### Database Tables

`message_threads`, `message_thread_participants`, `messages`, `message_read_receipts`, `message_attachments`, `users`, `projects`, `file_uploads`, `notifications`.

### Backend Services

`MessagingCommandService`, `MessagingQueryService`, `MessageParticipantService`, `MessageReadService`, `MessageSearchService`, `FileService`, `NotificationService`.

### API Endpoints

`GET /api/v1/message-threads`, `POST /api/v1/message-threads`, `GET /api/v1/message-threads/{thread_id}`, `PATCH /api/v1/message-threads/{thread_id}`, `GET /api/v1/message-threads/{thread_id}/messages`, `POST /api/v1/message-threads/{thread_id}/messages`, `POST /api/v1/message-threads/{thread_id}/read`, `POST /api/v1/message-threads/{thread_id}/attachments`.

### Validation Rules

Message body or attachment required; sender participant; active users only; project accessible; attachment rules enforced.

### Security Requirements

Tenant-scoped; participant access only; clients blocked from internal-only threads; attachment access uses file policy.

### Acceptance Criteria

Users create threads/send messages; unread counts work; project threads link; clients message through permitted threads; attachments secure.

### Dependencies

Users, clients, projects, files, notifications.

### Testing Requirements

Thread, message, read receipt, participant auth, client visibility, attachment, tenant tests.

---

## 3.16 Notifications

### Objective

Implement in-app notifications for messages, approvals, rejections, attendance exceptions, document uploads, project updates, and issues.

### Features

Notification list, unread count, mark read, mark all read, categories, preferences, deep links, real-time-ready dispatch, role-specific targeting.

### Business Logic

Workflow events create notifications; deep links require permission when opened; preferences control eligible categories/channels; mark-read idempotent.

### Database Tables

`notifications`, `notification_preferences`, `users`, `companies`, `projects`, `issues`, `messages`, `progress_updates`, `time_entries`.

### Backend Services

`NotificationService`, `NotificationPreferenceService`, `NotificationDispatchService`, `AuthorizationService`.

### API Endpoints

`GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `POST /api/v1/notifications/{notification_id}/read`, `POST /api/v1/notifications/read-all`, `GET /api/v1/notification-preferences`, `PATCH /api/v1/notification-preferences`.

### Validation Rules

Notification belongs to user; categories/channels approved; related entities valid.

### Security Requirements

Users access own notifications only; payloads do not leak unauthorized data; deep links do not bypass RBAC.

### Acceptance Criteria

Relevant notifications display; unread count updates; preferences work; workflow notifications are created.

### Dependencies

Authentication, RBAC, workflow events.

### Testing Requirements

List, unread count, mark read, preference, workflow creation, auth, tenant tests.

---

## 3.17 AI Services

### Objective

Implement AI-assisted services for summaries, insights, messaging help, and reporting while preserving privacy, authorization, and tenant isolation.

### Features

Progress summaries, issue summaries, admin insights, client-safe summaries, message assistance, reporting summaries, AI audit trail, safety controls.

### Business Logic

AI consumes only authorized data; client-safe outputs use client-visible data only; payroll and medical files excluded by default; outputs are assistive; requests logged.

### Database Tables

`ai_requests`, `ai_outputs`, `users`, `companies`, `projects`, `progress_updates`, `issues`, `messages`, `audit_logs`.

### Backend Services

`AIService`, `AISafetyService`, `AIContextBuilderService`, `ProjectInsightService`, `IssueInsightService`, `ReportingInsightService`, `AuditService`.

### API Endpoints

`POST /api/v1/ai/projects/{project_id}/summary`, `POST /api/v1/ai/issues/{issue_id}/summary`, `POST /api/v1/ai/admin/insights`, `POST /api/v1/ai/client/projects/{project_id}/summary`, `POST /api/v1/ai/messages/draft`.

### Validation Rules

AI enabled for tenant; user has permission; records accessible; prompt length bounded; client summaries use visible data only.

### Security Requirements

Tenant-isolated AI calls; sensitive fields redacted; provider keys secure; metadata audited; outputs do not reveal unauthorized records.

### Acceptance Criteria

Authorized users generate summaries; clients receive safe summaries; unauthorized access blocked; AI failures safe.

### Dependencies

Projects, progress, issues, messaging, reporting, RBAC, AI provider config.

### Testing Requirements

Context/redaction unit tests, mocked provider integration tests, auth, client-safe data, audit, error handling.

---

## 3.18 Reporting

### Objective

Implement reporting and analytics for attendance, time, projects, progress, issues, documents, clients, and operational health.

### Features

Admin dashboard metrics, attendance reports, time reports, project reports, issue reports, progress reports, document reports, client reports, export-ready data.

### Business Logic

Reports aggregate tenant-scoped data; company timezone controls date ranges; deleted/inactive records excluded unless requested; client reports use visible data only.

### Database Tables

`companies`, `users`, `worker_profiles`, `client_profiles`, `projects`, `project_assignments`, `project_clients`, `time_entries`, `progress_updates`, `issues`, `file_uploads`, `notifications`, `audit_logs`.

### Backend Services

`AdminDashboardService`, `AttendanceReportService`, `TimeReportService`, `ProjectReportService`, `IssueReportService`, `DocumentReportService`, `ActivityFeedService`.

### API Endpoints

`GET /api/v1/admin/dashboard`, `GET /api/v1/admin/attendance/summary`, `GET /api/v1/admin/projects/summary`, `GET /api/v1/admin/issues/summary`, `GET /api/v1/admin/documents/pending`, `GET /api/v1/admin/activity-feed`, `GET /api/v1/reports/time`, `GET /api/v1/reports/projects`, `GET /api/v1/reports/issues`.

### Validation Rules

Valid date ranges; allowlisted filters/grouping; bounded export limits.

### Security Requirements

Reporting permissions required; no cross-tenant aggregation leaks; client reports restricted.

### Acceptance Criteria

Dashboard and reports match source records; unauthorized access blocked; large reports run as background jobs.

### Dependencies

Operational modules, RBAC, multi-tenancy.

### Testing Requirements

Aggregation, timezone, filter, authorization, tenant, performance query tests.

---

## 3.19 Public API

### Objective

Expose a secure, versioned, documented public API for approved integrations.

### Features

Versioning, API key/OAuth foundation, scoped access, OpenAPI docs, rate-limit hooks, webhook-ready events, integration audit logs.

### Business Logic

External consumers are tenant-scoped; credentials have scopes; breaking changes require new version; usage audited.

### Database Tables

`api_clients`, `api_client_scopes`, `companies`, `users`, `projects`, `time_entries`, `issues`, `file_uploads`, `audit_logs`.

### Backend Services

`PublicAPIAuthService`, `APIClientService`, `ScopeService`, `RateLimitService`, `PublicAPIAuditService`.

### API Endpoints

`GET /api/v1/public/projects`, `GET /api/v1/public/projects/{project_id}`, `GET /api/v1/public/issues`, `GET /api/v1/public/time-entries`, `GET /api/v1/public/files/{file_id}`, `POST /api/v1/admin/api-clients`, `GET /api/v1/admin/api-clients`, `DELETE /api/v1/admin/api-clients/{client_id}`.

### Validation Rules

Client name required; approved scopes; allowlisted filters; credentials active; public file access explicitly allowed.

### Security Requirements

Secrets hashed; scopes enforced; tenant scoped; rate limiting available; external usage audited.

### Acceptance Criteria

Admins manage credentials; valid credentials authenticate; revoked/invalid credentials fail; scope violations rejected; docs include public API.

### Dependencies

Authentication, RBAC, multi-tenancy, core services.

### Testing Requirements

Credential, scope, revocation, tenant, audit, OpenAPI schema tests.

---

## 3.20 Frontend Foundation

### Objective

Establish frontend foundation after backend contracts are tested.

### Features

App shell, typed API client, role-aware routing, shared UI components, global state, responsive layout, accessibility baseline, error boundaries.

### Business Logic

Frontend guards improve UX; backend remains authoritative; date/time display uses company timezone; API errors normalized.

### Database Tables

Frontend consumes APIs backed by `users`, `companies`, `roles`, `permissions`, `notifications`.

### Backend Services

`AuthService`, `PermissionService`, `NotificationService`, `CompanySettingsService`.

### API Endpoints

`GET /api/v1/me`, `GET /api/v1/me/permissions`, `GET /api/v1/app/config`, `GET /api/v1/notifications/unread-count`.

### Validation Rules

Client-side forms validate before submit; server errors map to fields; route params validated; file inputs show limits.

### Security Requirements

Secure token strategy; protected routes; access denied states; sensitive data not over-cached.

### Acceptance Criteria

Shell loads; API client handles responses; navigation reflects permissions; shared components work.

### Dependencies

Backend auth/config/permissions/notifications complete; OpenAPI available; UX decisions from Part 2.

### Testing Requirements

API client, guards, accessibility, responsive, contract tests.

---

## 3.21 Frontend Modules

### Objective

Implement role-specific frontend modules using stable backend APIs.

### Features

Authentication, RBAC UI, worker dashboard, admin dashboard, client portal, project management, attendance, time tracking, progress updates, issue reporting, messaging, notifications, file uploads.

### Business Logic

UI calls backend APIs and does not duplicate domain rules; workers/admins/clients see role-appropriate views; mutation screens handle validation, conflict, auth, and success states.

### Database Tables

All core workflow tables through API-backed access.

### Backend Services

All implemented backend services through API endpoints only.

### API Endpoints

All user-facing endpoints from sections 3.2 through 3.20.

### Validation Rules

Required fields, enum values, dates, file limits, confirmations, and client-visible toggles enforced in UI while backend remains authoritative.

### Security Requirements

Route/action guards; sensitive docs protected; client UI excludes internal fields; safe handling of authorization errors.

### Acceptance Criteria

Worker, admin, and client workflows function end to end through UI; loading/empty/error/permission states handled.

### Dependencies

Frontend foundation, backend APIs, OpenAPI, Part 2 UX.

### Testing Requirements

Component, form, guard, mocked API, accessibility, responsive tests.

---

## 3.22 Integration Testing

### Objective

Verify repositories, services, database constraints, RBAC, tenant isolation, audit logs, files, notifications, and APIs together.

### Features

Database tests, repository tests, service tests, API tests, RBAC tests, tenant tests, audit tests, file tests, notification tests.

### Business Logic

Tests exercise real database constraints; avoid global event-loop-bound asyncpg pools; verify success and failure paths; assert audit logs.

### Database Tables

All workflow-critical tables, especially identity, tenancy, profile, project, operation, communication, file, and audit tables.

### Backend Services

All repository and service classes.

### API Endpoints

All protected and public endpoints.

### Validation Rules

Tenant-scoped test data; explicit roles/permissions; valid and invalid file payloads; timezone boundaries; response shape assertions.

### Security Requirements

Unauthorized requests fail; unauthorized authenticated requests fail; cross-tenant reads/writes fail; sensitive docs protected; public API scopes enforced.

### Acceptance Criteria

Tenant isolation, RBAC, FK integrity, cascade/restrict deletes, soft deletes, audit logs, UUID generation, index usage, and reversible migrations are verified.

### Dependencies

Backend implementation, test database, Alembic migrations, fixtures.

### Testing Requirements

Async pytest integration suite, migration tests, security suite, query-plan checks, CI script.

---

## 3.23 End-to-End Testing

### Objective

Verify complete worker, admin, and client journeys across backend and frontend.

### Features

Worker daily workflow, admin workflow, client workflow, RBAC workflow, tenant isolation workflow, file workflow, notification workflow.

### Business Logic

Use realistic role users; backend remains authorization source; verify UI state and persisted side effects.

### Database Tables

Full operational schema across identity, tenancy, profiles, projects, operations, communication, files, audit.

### Backend Services

All implemented backend services through APIs.

### API Endpoints

All user-facing endpoints.

### Validation Rules

Isolated test data; independent tests; fixture files; assert UI and backend state.

### Security Requirements

Access denied behavior verified; client internal-data hiding verified; sensitive files protected; logout/session expiration tested.

### Acceptance Criteria

Worker, admin, client, RBAC, tenant, file, and notification E2E workflows pass in CI.

### Dependencies

Backend, frontend, seed data, browser automation tooling.

### Testing Requirements

Browser E2E tests, API verification helpers, CI environment, traces/screenshots on failure, accessibility smoke checks.

---

## 3.24 Docker & Deployment

### Objective

Package and deploy the system using production-grade Docker, migrations, health checks, observability, and CI/CD practices.

### Features

Backend image, frontend image, worker image, Docker Compose, migration command, environment config, health checks, logging, static assets, file storage config, CI/CD.

### Business Logic

Migrations run through controlled release step; startup fails on invalid config; production containers do not use dev servers; secrets come from environment/secret manager.

### Database Tables

Deployment preserves and migrates all application tables.

### Backend Services

`HealthService`, `MigrationRunner`, `StorageService`, `LoggingConfig`.

### API Endpoints

`GET /api/v1/health`, `GET /api/v1/health/database`.

### Validation Rules

Required env vars validated; async PostgreSQL URL; explicit production CORS; valid storage config; secrets not logged.

### Security Requirements

Non-root containers where possible; no test secrets in production; debug disabled; HTTPS assumptions documented; reversible migrations tested.

### Acceptance Criteria

Images build; compose stack starts; migrations apply; health checks pass; CI runs tests before deploy.

### Dependencies

Backend complete, frontend complete, tests passing, production config defined.

### Testing Requirements

Docker build, compose smoke, migration upgrade/downgrade, container health, config validation, deployment checklist.

---

## 6. Part 3 Definition of Done

Part 3 is complete only when all items in [Definition of Done](./Definition-of-Done.md) are satisfied and:

- Backend foundation is implemented.
- Core platform services are complete.
- Operational workflows are complete.
- AI and reporting APIs are complete.
- Public API foundation is complete.
- Frontend consumes tested backend APIs.
- Unit, integration, security, tenant-isolation, migration, and E2E tests pass.
- Docker and deployment configuration are production-ready.


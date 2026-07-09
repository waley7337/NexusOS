# Architecture Guidelines

This document defines the required backend architecture for the SaaS platform. It does not change the implementation order; it formalizes how each phase must be built.

## 1. Backend-First Flow

The implementation order is:

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

Frontend modules may begin only after the relevant backend contracts are implemented and tested.

## 2. Module Architecture

Each module follows:

```text
Model
  -> Repository
  -> Service
  -> Schemas
  -> Router
  -> Tests
```

Recommended folder structure:

```text
app/
  core/
    config.py
    database.py
    security.py
    errors.py
    logging.py
    pagination.py
    events.py
  modules/
    workers/
      models.py
      schemas.py
      repository.py
      service.py
      events.py
      router.py
      permissions.py
      tests/
```

## 3. Transaction Boundaries

Transactions are service-level concerns. Routers must not open transactions directly unless through approved dependencies.

### Create Worker

```text
Begin transaction
  -> Validate admin permission
  -> Validate company context
  -> Create User
  -> Assign worker role
  -> Create Worker Profile
  -> Create Audit Log
  -> Record WorkerCreatedEvent
Commit transaction
After commit
  -> Queue invitation email
  -> Queue notification
Rollback
  -> If any required database operation fails, roll back all database changes
```

### Invite Client

```text
Begin transaction
  -> Validate admin permission
  -> Create or link User
  -> Create Client Profile
  -> Assign client role
  -> Create Invitation
  -> Create Audit Log
  -> Record ClientInvitedEvent
Commit transaction
After commit
  -> Queue invitation email
Rollback
  -> Roll back profile, role, invitation, and audit changes
```

### Check In

```text
Begin transaction
  -> Validate worker identity
  -> Validate active worker profile
  -> Validate project assignment where required
  -> Verify no active open time entry
  -> Create Time Entry
  -> Create Audit Log
  -> Record AttendanceStartedEvent
Commit transaction
Rollback
  -> No time entry is created
```

### Check Out

```text
Begin transaction
  -> Validate worker identity
  -> Find active open time entry
  -> Validate checkout timestamp
  -> Update Time Entry
  -> Calculate duration server-side
  -> Create Audit Log
  -> Record AttendanceCompletedEvent
Commit transaction
After commit
  -> Queue notifications and analytics updates
Rollback
  -> Time entry remains open and unchanged
```

### Report Issue

```text
Begin transaction
  -> Validate user permission
  -> Validate project access
  -> Create Issue
  -> Link uploaded files if provided
  -> Create Audit Log
  -> Record IssueReportedEvent
Commit transaction
After commit
  -> Queue notifications
  -> Queue AI summary if enabled
Rollback
  -> Issue and file links are not persisted
```

### Upload File

```text
Begin transaction
  -> Validate user permission
  -> Validate file metadata
  -> Store object or prepare staged storage reference
  -> Create File Upload metadata
  -> Create Audit Log
  -> Record FileUploadedEvent
Commit transaction
After commit
  -> Queue virus scan
  -> Queue notifications where required
Rollback
  -> Delete staged object if storage occurred before rollback
```

## 4. Domain Events

Domain events must be emitted from services after state changes are persisted in the current unit of work.

Event examples:

- `WorkerCreatedEvent`
- `ClientInvitedEvent`
- `AttendanceStartedEvent`
- `AttendanceCompletedEvent`
- `TimeEntryApprovedEvent`
- `ProgressUpdateSubmittedEvent`
- `ProgressUpdateApprovedEvent`
- `IssueReportedEvent`
- `IssueResolvedEvent`
- `ProjectCompletedEvent`
- `FileUploadedEvent`
- `MessageSentEvent`

Events may trigger:

- Notifications.
- Emails.
- Audit logs.
- Analytics.
- AI processing.
- Report refreshes.

Unrelated services must communicate through events instead of direct coupling.

## 5. CQRS Guidance

Use command/query separation for modules with complex workflows or dashboard reads.

| Module | Required Pattern |
| --- | --- |
| Projects | `ProjectCommandService`, `ProjectQueryService` |
| Workers | `WorkerCommandService`, `WorkerQueryService` |
| Clients | `ClientCommandService`, `ClientQueryService` |
| Attendance | Command/query split recommended |
| Time Tracking | Command/query split recommended |
| Reporting | Query service only |
| Notifications | Single service acceptable unless scale requires split |
| Files | Command/query split recommended |

## 6. Background Jobs

Use Celery + Redis, or the project's chosen queue, for asynchronous work.

Must run asynchronously:

- Email delivery.
- Notification fan-out where large.
- Virus scanning.
- PDF generation.
- Excel export.
- AI summaries.
- Weekly reports.
- Large imports.
- Long-running analytics refreshes.

Jobs must be:

- Idempotent.
- Retriable.
- Observable.
- Tenant-aware.
- Linked to request or event IDs where available.

## 7. File Storage Strategy

Upload lifecycle:

```text
Upload
  -> Validation
  -> Virus Scan
  -> Object Storage
  -> Metadata Persistence
  -> Permission Check
  -> Signed URL
  -> Download
```

Rules:

- Store binary objects outside the relational database.
- Store metadata in `file_uploads`.
- Use signed URLs or streaming downloads.
- Never expose raw storage keys.
- Enforce permissions before preview or download.
- Define retention policies for payroll slips, medical certificates, and project files.

## 8. Logging Standards

Every request log must include:

- Request ID.
- Company ID.
- User ID.
- HTTP method.
- Endpoint.
- Status code.
- Duration.
- IP address.
- User agent.

Errors must include stack traces in logs only, never in API responses.

## 9. Observability

The system should support:

- Structured JSON logs.
- Request IDs propagated through services and jobs.
- Database query timing for slow queries.
- Background job status and retry logging.
- Error tracking integration.
- Health and readiness endpoints.

## 10. Security Architecture

Every module must enforce:

- Authentication.
- RBAC.
- Tenant isolation.
- Input validation.
- Output shaping.
- Audit logging.
- Secure file access where applicable.
- No hardcoded secrets.


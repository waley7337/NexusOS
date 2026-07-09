# Engineering Rules

These rules are mandatory for every backend and frontend module in this project. They preserve the backend-first architecture and keep implementation consistent across a professional engineering team.

## 1. Layering Rules

| Layer | Responsibility | Prohibited |
| --- | --- | --- |
| Router | HTTP transport, dependency injection, request parsing, response mapping | Business logic, direct SQL, direct ORM mutation |
| Schema | Request and response contracts using Pydantic v2 | Database access, business decisions |
| Service | Business logic, transactions, authorization orchestration, domain events | Returning ORM models directly to routers |
| Repository | Database reads and writes only | Business rules, HTTP concerns, permission decisions |
| Model | SQLAlchemy persistence mapping | Request validation, response formatting |
| Event handler | Side effects triggered by domain events | Replacing core transaction rules |

## 2. Mandatory Rules

- Routers must never contain business logic.
- Services contain all business logic.
- Repositories only access the database.
- Services never expose ORM models directly; they return schemas, DTOs, or typed domain results.
- Every endpoint must define request and response schemas.
- Every write operation creates an audit event where appropriate.
- Every tenant-owned query must automatically scope by `company_id`.
- Every tenant-owned mutation must validate same-company relationships.
- Every module must include unit and integration tests.
- No secrets may be hardcoded.
- OpenAPI documentation must stay synchronized with implementation.
- Every new feature must follow the project folder structure and architecture.
- Async database code must use SQLAlchemy 2.0 async APIs.
- Test database engines must avoid event-loop-bound global pooled connections.
- Soft-deleted records must be excluded from default queries.
- All timestamps must be timezone-aware.
- All user-facing errors must use the global error response format.

## 3. Required Module Structure

Each backend module must follow this structure:

```text
app/
  modules/
    <module_name>/
      models.py
      schemas.py
      repository.py
      service.py
      events.py
      router.py
      permissions.py
      tests/
        test_<module_name>_repository.py
        test_<module_name>_service.py
        test_<module_name>_api.py
```

Larger modules may split services into command and query services:

```text
project_repository.py
project_query_service.py
project_command_service.py
project_schemas.py
project_router.py
project_tests/
```

## 4. Repository Pattern

The required flow is:

```text
Router
  -> Schema validation
  -> Service
  -> Repository
  -> Database
```

Example:

```text
WorkerRepository
  -> WorkerService
  -> WorkerSchemas
  -> WorkerRouter
  -> WorkerTests
```

Repository rules:

- Use repository methods for all database access.
- Apply tenant scoping inside base repository helpers.
- Keep repository methods deterministic and side-effect free except for database persistence.
- Do not send notifications, emails, audit logs, or AI jobs from repositories.
- Do not return unbounded collections.

## 5. Service Rules

Services must:

- Own business workflows.
- Define transaction boundaries.
- Validate RBAC and tenant access through shared policy services.
- Emit domain events after successful state changes.
- Create audit logs for sensitive and business-critical writes.
- Return response-ready DTOs or schemas.

Services must not:

- Depend on HTTP request objects directly.
- Return raw ORM models to routers.
- Perform unrelated side effects directly when a domain event is appropriate.

## 6. Transaction Boundary Rules

Each write workflow must document:

- Start of transaction.
- Required database writes.
- Required validation checks.
- Audit-log creation.
- Domain events emitted.
- Background jobs queued after commit.
- Rollback behavior.

If any required operation inside the transaction fails, the transaction must roll back. External side effects such as email, push notifications, AI processing, PDF generation, or exports must be queued only after the database transaction successfully commits.

## 7. Domain Event Rules

Domain events decouple core workflows from secondary effects.

Examples:

| Event | Typical Consumers |
| --- | --- |
| `WorkerCreatedEvent` | Audit logs, invitation email, analytics |
| `ClientInvitedEvent` | Email, notification, audit logs |
| `AttendanceCompletedEvent` | Notifications, analytics, reporting |
| `IssueReportedEvent` | Notifications, email, analytics, AI summary |
| `ProjectCompletedEvent` | Notifications, reporting, AI summary |
| `FileUploadedEvent` | Virus scan, audit logs, notification |
| `ProgressUpdateApprovedEvent` | Client notification, analytics, reporting |

Rules:

- Domain events must be named in past tense.
- Events must include `event_id`, `company_id`, `actor_user_id`, `occurred_at`, and related entity IDs.
- Event handlers must be idempotent.
- Event handlers must not weaken authorization rules.
- Event processing failures must be logged and retriable.

## 8. CQRS Rules

Apply CQRS when a module has materially different read and write concerns.

Use separate services when:

- Read models require joins, aggregation, or dashboard queries.
- Write operations enforce complex workflows.
- Query endpoints need performance optimization independent from commands.
- Public or client-facing reads expose a restricted projection.

Examples:

```text
ProjectQueryService
ProjectCommandService
WorkerQueryService
WorkerCommandService
ReportQueryService
```

A single service is acceptable when:

- The module is small.
- Reads and writes are simple.
- There is no special projection, aggregation, or workflow complexity.

## 9. Test Rules

Every module must include:

- Unit tests for pure business rules.
- Repository integration tests against PostgreSQL.
- Service integration tests for workflow behavior.
- API tests for authentication, authorization, validation, and response shape.
- Tenant isolation tests.
- Audit-log tests for write workflows.
- Negative tests for forbidden and invalid operations.


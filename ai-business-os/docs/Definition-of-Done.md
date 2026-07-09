# Definition of Done

A module is complete only when it satisfies every applicable item in this document.

## 1. Module Completion Checklist

| Requirement | Required |
| --- | --- |
| Models | Yes |
| Schemas | Yes |
| Repository | Yes |
| Service | Yes |
| Router | Yes |
| Tests | Yes |
| Permissions | Yes |
| Audit logging | Yes, where appropriate |
| OpenAPI documentation | Yes |
| Integration tests | Yes |
| Security validation | Yes |
| Performance validation | Yes |

## 2. Engineering Completion

- Follows the required folder structure.
- Uses async SQLAlchemy 2.0 correctly.
- Keeps business logic out of routers.
- Keeps database access inside repositories.
- Returns schemas or DTOs rather than ORM models from services.
- Uses transaction boundaries documented for the workflow.
- Emits domain events where side effects are needed.
- Uses background jobs for long-running work.

## 3. API Completion

- Request schema exists.
- Response schema exists.
- Standard success response is used.
- Standard error response is used.
- Error codes come from the catalog.
- Pagination and filtering follow global standards.
- OpenAPI summary and description are complete.
- Authentication and permission requirements are documented.

## 4. Security Completion

- Authentication enforced where required.
- RBAC enforced in backend services and routes.
- Tenant isolation tested.
- Cross-tenant relationships rejected.
- Sensitive fields excluded from unauthorized responses.
- No hardcoded secrets.
- Audit logs created for sensitive and business-critical writes.
- File access is permission checked.

## 5. Testing Completion

- Unit tests pass.
- Repository integration tests pass.
- Service integration tests pass.
- API tests pass.
- RBAC tests pass.
- Tenant isolation tests pass.
- Audit-log tests pass.
- Validation tests pass.
- Migration tests pass where schema changes are introduced.
- Performance validation completed for critical paths.

## 6. Documentation Completion

- Module README or implementation notes are updated where needed.
- OpenAPI documentation is current.
- New permissions are documented.
- New error codes are documented.
- New domain events are documented.
- New background jobs are documented.
- Operational configuration is documented.

## 7. Release Readiness

- Code is reviewed.
- Tests pass in CI.
- Migrations are reversible where practical.
- Rollback behavior is understood.
- Observability is in place.
- Deployment configuration is updated if needed.
- No debug flags or development secrets are enabled.


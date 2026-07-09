# Performance Standards

Performance requirements must be measurable, tested, and tracked over time. Targets apply to production-like environments with realistic data volumes.

## 1. API Performance Targets

| Workflow | Target |
| --- | --- |
| Authentication | Less than 150 ms p95 |
| Current user context | Less than 100 ms p95 |
| Simple record read | Less than 100 ms p95 |
| Search/list endpoint | Less than 200 ms p95 |
| Dashboard endpoint | Less than 500 ms p95 |
| Check-in/check-out | Less than 200 ms p95 |
| Time-entry approval | Less than 200 ms p95 |
| Issue reporting without file | Less than 250 ms p95 |
| File upload metadata creation | Less than 300 ms p95, excluding object transfer |
| File upload end-to-end | Less than 2 seconds for configured normal file size |
| Notification unread count | Less than 100 ms p95 |
| Large reports | Background job |
| AI summaries | Background job or async request with timeout policy |

## 2. Database Performance Rules

- Every foreign key used in frequent filtering must be indexed.
- Every tenant-owned table must support efficient `company_id` filtering.
- Composite indexes must support common query patterns.
- Dashboard queries must avoid N+1 behavior.
- Large collections must be paginated.
- Query plans must be checked for critical endpoints.
- Soft-delete filters must be index-aware where needed.

## 3. Collection Query Requirements

Every collection endpoint must:

- Use pagination.
- Bound `page_size`.
- Use allowlisted sorting.
- Apply tenant scope early.
- Avoid loading unused relationships.
- Return only required fields where practical.

## 4. Background Job Performance

These operations must run asynchronously:

- Email.
- Notification fan-out for large recipient sets.
- PDF generation.
- Excel export.
- AI summaries.
- Weekly reports.
- Large imports.
- Virus scanning.
- Long-running analytics refreshes.

Jobs must define:

- Queue name.
- Retry policy.
- Timeout.
- Idempotency key.
- Failure logging.
- Tenant context.

## 5. File Performance

- Large files must not be buffered entirely in application memory.
- Downloads should use signed URLs or streaming responses.
- Virus scanning must not block request threads beyond the accepted upload workflow.
- Metadata writes must remain transactional.
- File preview generation should be asynchronous for large files.

## 6. Reporting Performance

- Small reports may return synchronously when within target latency.
- Large reports must run as background jobs.
- Exports must have status tracking.
- Reports must use indexed filters and bounded date ranges.
- Repeated dashboard summaries may use cached or precomputed values when needed.

## 7. Performance Validation

Each module must include performance validation for:

- Primary list endpoint.
- Primary detail endpoint.
- Primary write endpoint.
- Tenant-scoped query behavior.
- Any dashboard or aggregate endpoint.

Performance tests may run in a dedicated suite, but critical query-plan checks must be part of integration validation.


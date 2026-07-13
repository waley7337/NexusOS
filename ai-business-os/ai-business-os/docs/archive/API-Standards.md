# API Standards

All API endpoints must follow this standard. The API must remain consistent, versioned, documented, secure, and predictable for frontend and public API consumers.

## 1. Versioning

All application endpoints use:

```text
/api/v1
```

Breaking changes require a new version. Backward-compatible additions may remain within the current version.

## 2. Standard Success Response

Every successful endpoint must return:

```json
{
  "success": true,
  "message": "",
  "data": {},
  "meta": {}
}
```

Rules:

- `success` is always `true`.
- `message` is human-readable and may be empty.
- `data` contains the resource, collection, or command result.
- `meta` contains pagination, request IDs, timing, or supplemental metadata.

## 3. Standard Error Response

Every failed endpoint must return:

```json
{
  "success": false,
  "error": {
    "code": "",
    "message": ""
  }
}
```

Extended error responses may include field-level details:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_001",
    "message": "Validation failed.",
    "details": [
      {
        "field": "email",
        "message": "Enter a valid email address."
      }
    ]
  }
}
```

Rules:

- Error codes must come from the error-code catalog.
- Messages must be safe for users.
- Stack traces must never be returned to clients.
- Validation details should map to form fields where possible.

## 4. Pagination Standard

Every collection endpoint must support the same pagination parameters:

| Parameter | Type | Default | Rule |
| --- | --- | --- | --- |
| `page` | integer | `1` | Must be greater than or equal to `1` |
| `page_size` | integer | `25` | Must be between `1` and the configured maximum |
| `search` | string | empty | Must be trimmed and length-bounded |
| `sort` | string | endpoint default | Must be allowlisted |
| `order` | string | `asc` | Must be `asc` or `desc` |

Paginated responses must include:

```json
{
  "success": true,
  "message": "",
  "data": [],
  "meta": {
    "page": 1,
    "page_size": 25,
    "total_items": 0,
    "total_pages": 0,
    "sort": "created_at",
    "order": "desc"
  }
}
```

## 5. Filtering Standard

Reusable filter names:

| Filter | Purpose |
| --- | --- |
| `status` | Filter by workflow status |
| `created_before` | Records created before timestamp |
| `created_after` | Records created after timestamp |
| `updated_before` | Records updated before timestamp |
| `updated_after` | Records updated after timestamp |
| `assigned_to` | User or worker assignment |
| `project_id` | Project association |
| `company_id` | Platform-level tenant filter only |
| `worker_id` | Worker association |
| `client_id` | Client association |
| `is_active` | Active/inactive filter |

Rules:

- Filters must be allowlisted per endpoint.
- Tenant users must not be able to override `company_id`.
- Date filters must be timezone-aware.
- Invalid filters must return a validation error.

## 6. OpenAPI Standards

Every endpoint must include:

- Summary.
- Description.
- Request schema.
- Response schema.
- Error responses.
- Authentication requirements.
- Permission requirements.
- Pagination and filter documentation where applicable.
- Example request and response for complex workflows.

Swagger documentation must remain current with implementation.

## 7. Authentication and Authorization

Every protected endpoint must:

- Require a valid authenticated user.
- Resolve current company context.
- Enforce required permissions.
- Return `AUTH_*` errors for authentication failures.
- Return `RBAC_*` errors for authorization failures.

## 8. HTTP Status Standards

| Status | Usage |
| --- | --- |
| `200` | Successful read or mutation with response body |
| `201` | Resource created |
| `202` | Accepted for asynchronous processing |
| `204` | Successful operation with no response body, used sparingly |
| `400` | Invalid request |
| `401` | Missing or invalid authentication |
| `403` | Authenticated but unauthorized |
| `404` | Resource not found or not accessible |
| `409` | Conflict or invalid state transition |
| `422` | Validation error |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

## 9. Request Metadata

Every request must have:

- `request_id`
- authenticated `user_id` where available
- resolved `company_id` where available
- IP address
- user agent
- start time and duration

## 10. Collection Endpoint Requirements

Collection endpoints must:

- Be paginated.
- Support allowlisted sorting.
- Support module-appropriate filters.
- Exclude soft-deleted records by default.
- Respect tenant isolation.
- Avoid unbounded joins or N+1 queries.


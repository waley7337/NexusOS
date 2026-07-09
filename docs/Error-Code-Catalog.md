# Error Code Catalog

Every business error must have a stable error code. Error codes are part of the API contract and must not be changed casually once released.

## 1. Format

```text
<DOMAIN>_<NUMBER>
```

Examples:

- `AUTH_001`
- `USER_001`
- `PROJECT_004`
- `WORKER_003`
- `FILE_002`
- `INVITATION_005`

## 2. Global Errors

| Code | Meaning |
| --- | --- |
| `GLOBAL_001` | Unexpected server error |
| `GLOBAL_002` | Validation failed |
| `GLOBAL_003` | Resource not found |
| `GLOBAL_004` | Conflict |
| `GLOBAL_005` | Unsupported operation |
| `GLOBAL_006` | Rate limit exceeded |

## 3. Authentication Errors

| Code | Meaning |
| --- | --- |
| `AUTH_001` | Missing authentication credentials |
| `AUTH_002` | Invalid credentials |
| `AUTH_003` | Expired access token |
| `AUTH_004` | Invalid refresh token |
| `AUTH_005` | Disabled account |
| `AUTH_006` | Password reset token invalid or expired |
| `AUTH_007` | Invitation token invalid or expired |
| `AUTH_008` | Session revoked |

## 4. RBAC Errors

| Code | Meaning |
| --- | --- |
| `RBAC_001` | Permission denied |
| `RBAC_002` | Role not found |
| `RBAC_003` | System role cannot be modified |
| `RBAC_004` | System permission cannot be modified |
| `RBAC_005` | Cannot remove final admin role |
| `RBAC_006` | Invalid permission assignment |

## 5. Tenant Errors

| Code | Meaning |
| --- | --- |
| `TENANT_001` | Company context missing |
| `TENANT_002` | Cross-tenant access denied |
| `TENANT_003` | Cross-tenant relationship rejected |
| `TENANT_004` | Company inactive or suspended |

## 6. User and Invitation Errors

| Code | Meaning |
| --- | --- |
| `USER_001` | User not found |
| `USER_002` | Email already exists |
| `USER_003` | User is inactive |
| `USER_004` | Invalid user status transition |
| `INVITATION_001` | Invitation not found |
| `INVITATION_002` | Invitation expired |
| `INVITATION_003` | Invitation already accepted |
| `INVITATION_004` | Invitation company mismatch |
| `INVITATION_005` | Invitation role invalid |

## 7. Worker and Client Errors

| Code | Meaning |
| --- | --- |
| `WORKER_001` | Worker not found |
| `WORKER_002` | Worker profile already exists |
| `WORKER_003` | Worker is not active |
| `WORKER_004` | Worker is not assigned to project |
| `CLIENT_001` | Client not found |
| `CLIENT_002` | Client profile already exists |
| `CLIENT_003` | Client is not linked to project |
| `CLIENT_004` | Client-visible data restriction |

## 8. Project Errors

| Code | Meaning |
| --- | --- |
| `PROJECT_001` | Project not found |
| `PROJECT_002` | Duplicate project name |
| `PROJECT_003` | Invalid project date range |
| `PROJECT_004` | Invalid project status transition |
| `PROJECT_005` | Archived project cannot be modified |
| `PROJECT_006` | Invalid project assignment |

## 9. Attendance and Time Errors

| Code | Meaning |
| --- | --- |
| `ATTENDANCE_001` | Worker already checked in |
| `ATTENDANCE_002` | No active check-in found |
| `ATTENDANCE_003` | Check-out must be after check-in |
| `ATTENDANCE_004` | Project selection required |
| `TIME_001` | Time entry not found |
| `TIME_002` | Time entry overlap detected |
| `TIME_003` | Approved entry cannot be edited |
| `TIME_004` | Rejection reason required |

## 10. Progress and Issue Errors

| Code | Meaning |
| --- | --- |
| `PROGRESS_001` | Progress update not found |
| `PROGRESS_002` | Progress percentage out of range |
| `PROGRESS_003` | Progress update cannot be modified |
| `PROGRESS_004` | Rejection reason required |
| `ISSUE_001` | Issue not found |
| `ISSUE_002` | Invalid issue severity |
| `ISSUE_003` | Invalid issue status transition |
| `ISSUE_004` | Resolution notes required |
| `ISSUE_005` | Reopen reason required |

## 11. File, Message, Notification, AI, and Report Errors

| Code | Meaning |
| --- | --- |
| `FILE_001` | File not found |
| `FILE_002` | File type not allowed |
| `FILE_003` | File exceeds size limit |
| `FILE_004` | File access denied |
| `FILE_005` | Virus scan failed |
| `MESSAGE_001` | Thread not found |
| `MESSAGE_002` | User is not a participant |
| `MESSAGE_003` | Message body or attachment required |
| `NOTIFICATION_001` | Notification not found |
| `AI_001` | AI feature disabled |
| `AI_002` | AI context not permitted |
| `REPORT_001` | Invalid report date range |
| `PUBLIC_API_001` | Invalid API credential |
| `PUBLIC_API_002` | API scope denied |


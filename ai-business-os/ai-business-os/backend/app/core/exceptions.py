"""Domain exceptions.

Services raise these; a single exception handler in main.py converts them
to the standard API envelope. Services never import HTTPException — keeping
the domain layer transport-agnostic.
"""
from typing import Any


class AppError(Exception):
    """Base class for all domain errors."""

    status_code: int = 500
    code: str = "internal_error"
    message: str = "An unexpected error occurred."

    def __init__(
        self, message: str | None = None, *, details: dict[str, Any] | None = None
    ) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"
    message = "Resource not found."


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"
    message = "Authentication required."


class ForbiddenError(AppError):
    status_code = 403
    code = "forbidden"
    message = "You do not have permission to perform this action."


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    message = "The request conflicts with the current state."


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"
    message = "Invalid input."


class TenantIsolationError(AppError):
    """Raised if a query would cross tenant boundaries. Should never happen —
    logged at CRITICAL and returned as a generic 404 to avoid leaking data."""

    status_code = 404
    code = "not_found"
    message = "Resource not found."


class RateLimitExceededError(AppError):
    status_code = 429
    code = "rate_limited"
    message = "Too many requests. Please try again later."

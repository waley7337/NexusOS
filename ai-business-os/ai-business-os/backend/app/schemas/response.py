"""Standard API envelope — every endpoint returns this shape.

    { "success": true, "data": ..., "message": "", "errors": null }

Frontend code can rely on it unconditionally.
"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    data: T | None = None
    message: str = ""
    errors: list[dict[str, Any]] | None = None

    @classmethod
    def ok(cls, data: T | None = None, message: str = "") -> "ApiResponse[T]":
        return cls(success=True, data=data, message=message)

    @classmethod
    def fail(
        cls, message: str, errors: list[dict[str, Any]] | None = None
    ) -> "ApiResponse[None]":
        return ApiResponse[None](success=False, data=None, message=message, errors=errors)


class PageMeta(BaseModel):
    page: int
    page_size: int = Field(alias="pageSize")
    total: int
    total_pages: int = Field(alias="totalPages")

    model_config = ConfigDict(populate_by_name=True)


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    meta: PageMeta

    @classmethod
    def build(cls, items: list[T], total: int, page: int, page_size: int) -> "Paginated[T]":
        return cls(
            items=items,
            meta=PageMeta(
                page=page,
                pageSize=page_size,
                total=total,
                totalPages=max(1, -(-total // page_size)),
            ),
        )

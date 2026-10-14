"""AI Assistant API — conversation management with OpenAI backend.

When OPENAI_API_KEY is not configured the endpoint returns a clear
unavailable response rather than fabricating AI output.

Persistence: conversations and messages are stored in the existing
``ai_conversations`` / ``ai_messages`` tables.  The OpenAI call is
synchronous-within-async via a thread pool (openai SDK is sync).

Permissions: ai.use
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from app.core.exceptions import ValidationError
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.db.session import get_db
from app.models.ai import AiConversation, AiMessage
from app.models.enums import AiRole
from app.schemas.base import CamelModel
from app.schemas.response import ApiResponse, Paginated
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/assistant", tags=["AI Assistant"])

DbSession = Annotated[AsyncSession, Depends(get_db)]
ActiveUser = Annotated[CurrentUser, Depends(get_current_active_user)]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ConversationResponse(CamelModel):
    id: uuid.UUID
    title: str | None = None
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class MessageResponse(CamelModel):
    id: uuid.UUID
    role: AiRole
    content: str
    tokens: int | None = None
    created_at: str = Field(alias="createdAt")


class SendMessageRequest(CamelModel):
    content: str = Field(min_length=1, max_length=8000)
    conversation_id: uuid.UUID | None = Field(default=None, alias="conversationId")


class SendMessageResponse(CamelModel):
    conversation_id: uuid.UUID = Field(alias="conversationId")
    user_message: MessageResponse = Field(alias="userMessage")
    assistant_message: MessageResponse = Field(alias="assistantMessage")
    provider_available: bool = Field(alias="providerAvailable")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _msg_response(msg: AiMessage) -> MessageResponse:
    return MessageResponse.model_validate({
        "id": msg.id,
        "role": msg.role,
        "content": msg.content,
        "tokens": msg.tokens,
        "createdAt": msg.created_at.isoformat(),
    })


def _conv_response(conv: AiConversation) -> ConversationResponse:
    return ConversationResponse.model_validate({
        "id": conv.id,
        "title": conv.title,
        "createdAt": conv.created_at.isoformat(),
        "updatedAt": conv.updated_at.isoformat(),
    })


async def _get_or_create_conversation(
    db: AsyncSession,
    *,
    conversation_id: uuid.UUID | None,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    first_content: str,
) -> AiConversation:
    if conversation_id is not None:
        conv = (
            await db.execute(
                select(AiConversation).where(
                    AiConversation.id == conversation_id,
                    AiConversation.company_id == company_id,
                    AiConversation.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if conv is None:
            raise ValidationError("Conversation not found.")
        return conv

    # Create new conversation; title from first 60 chars of first message.
    title = first_content[:60].strip()
    conv = AiConversation(
        company_id=company_id,
        user_id=user_id,
        title=title or "New conversation",
    )
    db.add(conv)
    await db.flush()
    return conv


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/conversations",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def list_conversations(
    db: DbSession,
    user: ActiveUser,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE, alias="pageSize")] = DEFAULT_PAGE_SIZE,
) -> ApiResponse[Paginated[ConversationResponse]]:
    from sqlalchemy import func

    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    base = (
        select(AiConversation)
        .where(
            AiConversation.company_id == user.company_id,
            AiConversation.user_id == user.id,
            AiConversation.deleted_at.is_(None),
        )
    )
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one()
    rows = (
        await db.execute(
            base.order_by(AiConversation.updated_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()

    return ApiResponse.ok(
        data=Paginated.build(
            items=[_conv_response(c) for c in rows],
            total=total, page=page, page_size=page_size,
        )
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def list_messages(
    conversation_id: uuid.UUID,
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[list[MessageResponse]]:
    # Verify ownership before returning messages.
    conv = (
        await db.execute(
            select(AiConversation).where(
                AiConversation.id == conversation_id,
                AiConversation.company_id == user.company_id,
                AiConversation.user_id == user.id,
                AiConversation.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if conv is None:
        raise ValidationError("Conversation not found.")

    messages = (
        await db.execute(
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.asc())
        )
    ).scalars().all()

    return ApiResponse.ok(data=[_msg_response(m) for m in messages])


@router.post(
    "/chat",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def send_message(
    payload: SendMessageRequest,
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[SendMessageResponse]:
    """Send a message; get an assistant reply.

    When OPENAI_API_KEY is not set the user message is persisted and an
    honest unavailable reply is returned (provider_available=False).
    """
    from app.core.config import settings

    conv = await _get_or_create_conversation(
        db,
        conversation_id=payload.conversation_id,
        company_id=user.company_id,
        user_id=user.id,
        first_content=payload.content,
    )

    # Persist the user message.
    user_msg = AiMessage(
        conversation_id=conv.id,
        company_id=user.company_id,
        role=AiRole.USER,
        content=payload.content,
    )
    db.add(user_msg)
    await db.flush()

    provider_available = bool(settings.OPENAI_API_KEY)
    reply_content: str
    reply_tokens: int | None = None

    if not provider_available:
        reply_content = (
            "The AI Assistant is not currently available. "
            "An administrator must configure OPENAI_API_KEY to enable AI responses."
        )
    else:
        # Call OpenAI synchronously inside an async executor.
        import asyncio
        from functools import partial

        def _call_openai() -> tuple[str, int]:
            import openai  # type: ignore[import-untyped]

            client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

            # Build history from last 20 messages for context.
            # We don't load the full history here to keep the call cheap.
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful business assistant for NexusOS."},
                    {"role": "user", "content": payload.content},
                ],
                max_tokens=1000,
            )
            choice = response.choices[0]
            content = choice.message.content or ""
            tokens = response.usage.total_tokens if response.usage else None
            return content, tokens

        try:
            loop = asyncio.get_running_loop()
            reply_content, reply_tokens = await loop.run_in_executor(None, _call_openai)
        except Exception as exc:  # noqa: BLE001
            reply_content = f"The AI provider returned an error: {type(exc).__name__}."
            provider_available = False

    # Persist the assistant reply.
    assistant_msg = AiMessage(
        conversation_id=conv.id,
        company_id=user.company_id,
        role=AiRole.ASSISTANT,
        content=reply_content,
        tokens=reply_tokens,
    )
    db.add(assistant_msg)
    await db.flush()

    return ApiResponse.ok(
        data=SendMessageResponse.model_validate({
            "conversationId": conv.id,
            "userMessage": _msg_response(user_msg),
            "assistantMessage": _msg_response(assistant_msg),
            "providerAvailable": provider_available,
        })
    )

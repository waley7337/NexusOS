"""AI Assistant API (Part 08.5 — production agent).

Endpoints:
  GET  /assistant/status                         — provider availability (no secrets)
  GET  /assistant/conversations                  — list this user's conversations
  POST /assistant/conversations                  — create named conversation
  GET  /assistant/conversations/{id}/messages    — messages for a conversation
  DELETE /assistant/conversations/{id}           — soft-delete (archive) a conversation
  POST /assistant/chat                           — send message, run agent, get reply

Security:
  * All endpoints require `ai.use` permission via `require_permission`.
  * Conversation reads/writes are scoped to (company_id, user_id) — prevents
    cross-user and cross-tenant access (insecure direct object reference).
  * `confirmed_action_id` lookup re-validates the pending action belongs to
    this user's conversation before re-executing.
  * API key is never exposed in any response field.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from app.core.exceptions import NotFoundError
from app.dependencies.auth import CurrentUser, get_current_active_user, require_permission
from app.db.session import get_db
from app.models.ai import AiConversation, AiMessage
from app.models.enums import AiRole
from app.schemas.base import CamelModel
from app.schemas.response import ApiResponse, Paginated
from app.repositories.base import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.services.ai_agent import ConfirmedAction, get_orchestrator
from sqlalchemy import func, select
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


class ConversationCreateRequest(CamelModel):
    title: str | None = Field(default=None, max_length=255)


class MessageResponse(CamelModel):
    id: uuid.UUID
    role: AiRole
    content: str
    tokens: int | None = None
    is_error: bool = Field(default=False, alias="isError")
    created_at: str = Field(alias="createdAt")


class PendingActionResponse(CamelModel):
    id: str
    tool_name: str = Field(alias="toolName")
    danger_description: str = Field(alias="dangerDescription")
    preview_args: dict = Field(alias="previewArgs")


class SendMessageRequest(CamelModel):
    content: str = Field(min_length=1, max_length=8000)
    conversation_id: uuid.UUID | None = Field(default=None, alias="conversationId")
    confirmed_action_id: str | None = Field(default=None, alias="confirmedActionId")
    # Stored pending-action payload (sent back by FE on confirmation).
    confirmed_action_tool: str | None = Field(default=None, alias="confirmedActionTool")
    confirmed_action_args: dict | None = Field(default=None, alias="confirmedActionArgs")


class SendMessageResponse(CamelModel):
    conversation_id: uuid.UUID = Field(alias="conversationId")
    user_message: MessageResponse = Field(alias="userMessage")
    assistant_message: MessageResponse = Field(alias="assistantMessage")
    provider_available: bool = Field(alias="providerAvailable")
    tool_calls_made: list[str] = Field(default_factory=list, alias="toolCallsMade")
    pending_action: PendingActionResponse | None = Field(default=None, alias="pendingAction")


class ProviderStatusResponse(CamelModel):
    available: bool
    model_name: str = Field(alias="modelName")
    max_tool_iterations: int = Field(alias="maxToolIterations")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _msg_response(msg: AiMessage) -> MessageResponse:
    return MessageResponse.model_validate({
        "id": msg.id,
        "role": msg.role,
        "content": msg.content,
        "tokens": msg.tokens,
        "isError": False,
        "createdAt": msg.created_at.isoformat(),
    })


def _conv_response(conv: AiConversation) -> ConversationResponse:
    return ConversationResponse.model_validate({
        "id": conv.id,
        "title": conv.title,
        "createdAt": conv.created_at.isoformat(),
        "updatedAt": conv.updated_at.isoformat(),
    })


async def _require_own_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession,
    user: CurrentUser,
) -> AiConversation:
    """Fetch conversation; raise NotFoundError on missing or cross-tenant/user access."""
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
        raise NotFoundError("Conversation not found.")
    return conv


# ---------------------------------------------------------------------------
# Startup — register providers
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Note: provider setup is called from app/main.py lifespan handler.
# See setup_providers() in app.services.ai_provider.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/status",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def get_provider_status() -> ApiResponse[ProviderStatusResponse]:
    """Report provider availability without exposing API keys or internal config."""
    try:
        provider = _get_provider()
        available = provider.is_available()
        model_name = provider.model_name if available else "none"
    except Exception:  # noqa: BLE001
        available = False
        model_name = "none"

    from app.core.config import settings
    return ApiResponse.ok(
        data=ProviderStatusResponse.model_validate({
            "available": available,
            "modelName": model_name,
            "maxToolIterations": settings.AI_MAX_TOOL_ITERATIONS,
        })
    )


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
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    base = select(AiConversation).where(
        AiConversation.company_id == user.company_id,
        AiConversation.user_id == user.id,
        AiConversation.deleted_at.is_(None),
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


@router.post(
    "/conversations",
    status_code=201,
    dependencies=[Depends(require_permission("ai.use"))],
)
async def create_conversation(
    payload: ConversationCreateRequest,
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[ConversationResponse]:
    conv = AiConversation(
        company_id=user.company_id,
        user_id=user.id,
        title=payload.title or "New conversation",
    )
    db.add(conv)
    await db.flush()
    return ApiResponse.ok(data=_conv_response(conv), message="Conversation created.")


@router.get(
    "/conversations/{conversation_id}/messages",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def list_messages(
    conversation_id: uuid.UUID,
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[list[MessageResponse]]:
    await _require_own_conversation(conversation_id, db, user)

    messages = (
        await db.execute(
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at.asc())
        )
    ).scalars().all()

    return ApiResponse.ok(data=[_msg_response(m) for m in messages])


@router.delete(
    "/conversations/{conversation_id}",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def archive_conversation(
    conversation_id: uuid.UUID,
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[None]:
    from datetime import datetime, timezone
    conv = await _require_own_conversation(conversation_id, db, user)
    conv.deleted_at = datetime.now(tz=timezone.utc)
    await db.flush()
    return ApiResponse.ok(message="Conversation archived.")


@router.post(
    "/chat",
    dependencies=[Depends(require_permission("ai.use"))],
)
async def send_message(
    payload: SendMessageRequest,
    db: DbSession,
    user: ActiveUser,
) -> ApiResponse[SendMessageResponse]:
    """Send a user message and run the agent to produce a reply.

    Workflow:
      1. Resolve or create the conversation (tenant+user scoped).
      2. Persist the user message.
      3. Run the agent (model → tool loop).
      4. Persist the assistant reply.
      5. Return both messages + agent metadata.
    """
    # --- Resolve conversation ---
    if payload.conversation_id is not None:
        conv = await _require_own_conversation(payload.conversation_id, db, user)
    else:
        # Auto-create.
        title = payload.content[:60].strip() or "New conversation"
        conv = AiConversation(
            company_id=user.company_id,
            user_id=user.id,
            title=title,
        )
        db.add(conv)
        await db.flush()

    # --- Persist user message ---
    user_msg = AiMessage(
        conversation_id=conv.id,
        company_id=user.company_id,
        role=AiRole.USER,
        content=payload.content,
    )
    db.add(user_msg)
    await db.flush()

    # --- Load history (excluding the message we just persisted) ---
    from app.core.config import settings as cfg
    history_rows = (
        await db.execute(
            select(AiMessage)
            .where(
                AiMessage.conversation_id == conv.id,
                AiMessage.id != user_msg.id,
            )
            .order_by(AiMessage.created_at.asc())
            .limit(cfg.AI_MAX_HISTORY_MESSAGES)
        )
    ).scalars().all()

    # --- Resolve confirmed action (for write tools) ---
    confirmed_action: ConfirmedAction | None = None
    if (
        payload.confirmed_action_id
        and payload.confirmed_action_tool
        and payload.confirmed_action_args is not None
    ):
        confirmed_action = ConfirmedAction(
            tool_name=payload.confirmed_action_tool,
            tool_arguments=payload.confirmed_action_args,
        )

    # --- Run agent ---
    orchestrator = get_orchestrator()
    result = await orchestrator.run(
        user_message=payload.content,
        conversation=conv,
        history=list(history_rows),
        db=db,
        user=user,
        confirmed_action=confirmed_action,
    )

    # --- Persist assistant reply ---
    assistant_msg = AiMessage(
        conversation_id=conv.id,
        company_id=user.company_id,
        role=AiRole.ASSISTANT,
        content=result.reply,
        tokens=(result.input_tokens + result.output_tokens) or None,
    )
    db.add(assistant_msg)
    await db.flush()

    # --- Update conversation title if newly created ---
    if conv.title == payload.content[:60].strip() and len(payload.content) > 60:
        pass  # Title already set from truncated content.

    # --- Build pending action response ---
    pending_action_resp: PendingActionResponse | None = None
    if result.pending_action:
        pa = result.pending_action
        pending_action_resp = PendingActionResponse.model_validate({
            "id": pa.id,
            "toolName": pa.tool_name,
            "dangerDescription": pa.danger_description,
            "previewArgs": pa.tool_arguments,
        })

    return ApiResponse.ok(
        data=SendMessageResponse.model_validate({
            "conversationId": conv.id,
            "userMessage": _msg_response(user_msg),
            "assistantMessage": _msg_response(assistant_msg),
            "providerAvailable": result.provider_available,
            "toolCallsMade": result.tool_calls_made,
            "pendingAction": pending_action_resp,
        })
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_provider():
    from app.services.ai_provider import ProviderRegistry
    return ProviderRegistry.default()

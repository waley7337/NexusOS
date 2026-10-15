"""AI Agent orchestrator — runs the model→tool loop, enforces all safety rules.

Safety invariants:
  1. Tenant isolation  — every tool call goes through the existing
     tenant-scoped repositories; company_id is always the caller's own.
  2. Permission check  — each tool's required_permissions are verified
     against the caller's fresh-from-DB permission set before execution.
     Model output CANNOT grant permissions.
  3. Write gate        — write tools produce a PendingAction instead of
     executing immediately. The caller must explicitly re-submit with
     confirmed_action_id to proceed.
  4. Iteration cap     — the loop stops at AI_MAX_TOOL_ITERATIONS to prevent
     runaway costs and infinite loops.
  5. History cap       — conversation context is trimmed to
     AI_MAX_HISTORY_MESSAGES to limit input tokens.
  6. No raw SQL        — tools use ORM queries; the model never sees or
     influences SQL strings.
  7. Secret-free logs  — API keys, auth headers, and full tool results are
     never logged (only counts / types).
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass

import structlog
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import CurrentUser
from app.models.ai import AiConversation, AiMessage
from app.services.ai_provider import (
    AssistantMessage,
    BaseAIProvider,
    ProviderError,
    ProviderUnavailableError,
    ProviderMessage,
    ToolCall,
)
from app.services.ai_tools import tool_registry

logger = structlog.get_logger("app.ai.agent")

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class AgentResult:
    """Returned to the API layer after agent orchestration completes."""
    reply: str
    provider_available: bool
    tool_calls_made: list[str]          # tool names that ran (for FE indicator)
    pending_action: "PendingAction | None" = None  # set when write tool was blocked
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class PendingAction:
    """Represents a write tool call blocked pending user confirmation."""
    id: str                  # UUID string — returned to FE, echoed back on confirm
    tool_name: str
    tool_arguments: dict
    danger_description: str  # Human-readable description for the confirm UI


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a business assistant for NexusOS, an integrated business management platform.

You have access to tools that retrieve real data from the user's business. Use them to answer questions accurately.

Rules you must always follow:
- Base answers on actual data from tool results. Do not invent figures, names, or records.
- If a tool returns no results, say so clearly.
- If you need to perform a write operation (create/update), describe what you will do and wait for the user to confirm.
- Never claim to have sent emails, created records, or made changes unless a tool result confirms it.
- For financial data, always include the currency.
- Keep responses concise and business-focused.
- If a capability is unavailable (no data, permission denied, module not configured), say so honestly.
"""


def _build_history(
    messages: list[AiMessage],
    max_messages: int,
) -> list[ProviderMessage]:
    """Convert stored AiMessages to provider wire format, trimmed to budget."""
    # Take the most recent `max_messages` messages.
    recent = messages[-max_messages:] if len(messages) > max_messages else messages

    wire: list[ProviderMessage] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in recent:
        role = msg.role.value if hasattr(msg.role, "value") else msg.role
        wire.append({"role": role, "content": msg.content})
    return wire


def _tool_result_message(tc: ToolCall, result: dict) -> ProviderMessage:
    return {
        "role": "tool",
        "tool_call_id": tc.id,
        "content": json.dumps(result),
    }


def _assistant_wire(msg: AssistantMessage) -> ProviderMessage:
    """Convert provider AssistantMessage back to wire format for history continuation."""
    wire: ProviderMessage = {"role": "assistant", "content": msg.content or ""}
    if msg.tool_calls:
        wire["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)},
            }
            for tc in msg.tool_calls
        ]
    return wire


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

class AgentOrchestrator:
    """Runs the agent loop for a single user turn."""

    def __init__(self, provider: BaseAIProvider) -> None:
        self._provider = provider

    async def run(
        self,
        *,
        user_message: str,
        conversation: AiConversation,
        history: list[AiMessage],
        db: AsyncSession,
        user: CurrentUser,
        confirmed_action: "ConfirmedAction | None" = None,
    ) -> AgentResult:
        """Execute one user turn, including the model→tool loop.

        Args:
            user_message:     Raw text from the user.
            conversation:     The AiConversation ORM object (tenant-verified by caller).
            history:          Past AiMessages for this conversation.
            db:               Database session (transaction owned by the API layer).
            user:             Authenticated, permission-hydrated CurrentUser.
            confirmed_action: Set when the user is confirming a previously proposed
                              write action (pending_action_id + approval).

        Returns:
            AgentResult with the final reply and metadata.
        """
        if not self._provider.is_available():
            return AgentResult(
                reply=(
                    "The AI Assistant is not currently available. "
                    "An administrator must configure OPENAI_API_KEY to enable AI responses."
                ),
                provider_available=False,
                tool_calls_made=[],
            )

        max_iter = settings.AI_MAX_TOOL_ITERATIONS
        max_history = settings.AI_MAX_HISTORY_MESSAGES

        # Build initial conversation history for the provider.
        wire_messages = _build_history(history, max_history)
        wire_messages.append({"role": "user", "content": user_message})

        # If the user is confirming a previously proposed write action, inject
        # it directly rather than re-discovering it through model reasoning.
        if confirmed_action is not None:
            return await self._execute_confirmed_action(
                confirmed_action=confirmed_action,
                wire_messages=wire_messages,
                db=db,
                user=user,
            )

        # Build tool schemas for the permitted, read-only tools.
        tools = tool_registry.openai_schemas(
            permitted=user.permissions,
            include_write=False,  # Write tools gated behind explicit confirmation.
        )

        tool_calls_made: list[str] = []
        total_input = 0
        total_output = 0

        try:
            for iteration in range(max_iter + 1):
                # Safety valve — never exceed iteration cap.
                if iteration == max_iter:
                    logger.warning(
                        "ai.agent.iteration_cap_reached",
                        conversation_id=str(conversation.id),
                        iterations=max_iter,
                    )
                    reply = (
                        "I reached the maximum number of steps for this request. "
                        "Please try rephrasing or breaking your question into smaller parts."
                    )
                    return AgentResult(
                        reply=reply,
                        provider_available=True,
                        tool_calls_made=tool_calls_made,
                        input_tokens=total_input,
                        output_tokens=total_output,
                    )

                # Call the model.
                response = await self._provider.complete(wire_messages, tools)
                total_input += response.input_tokens
                total_output += response.output_tokens

                if not response.requests_tools:
                    # Final text response — we're done.
                    return AgentResult(
                        reply=response.content or "(no response)",
                        provider_available=True,
                        tool_calls_made=tool_calls_made,
                        input_tokens=total_input,
                        output_tokens=total_output,
                    )

                # --- Tool calls requested ---
                # Add assistant message (with tool calls) to wire.
                wire_messages.append(_assistant_wire(response))

                # Check for write tools — block and require confirmation.
                for tc in response.tool_calls:
                    td = tool_registry.get(tc.name)
                    if td and td.write:
                        pending = PendingAction(
                            id=str(uuid.uuid4()),
                            tool_name=tc.name,
                            tool_arguments=tc.arguments,
                            danger_description=td.danger_description,
                        )
                        # Return a preview response; the API layer persists this
                        # and the frontend shows the confirmation dialog.
                        preview_reply = (
                            f"I'd like to {td.danger_description}. "
                            f"Please confirm this action to proceed."
                        )
                        return AgentResult(
                            reply=preview_reply,
                            provider_available=True,
                            tool_calls_made=tool_calls_made,
                            pending_action=pending,
                            input_tokens=total_input,
                            output_tokens=total_output,
                        )

                # Execute all read-only tool calls.
                tool_result_messages: list[ProviderMessage] = []
                for tc in response.tool_calls:
                    result = await self._execute_tool(tc, db=db, user=user)
                    tool_calls_made.append(tc.name)
                    tool_result_messages.append(_tool_result_message(tc, result))

                # Append tool results to wire and continue.
                wire_messages.extend(tool_result_messages)

        except ProviderUnavailableError as exc:
            logger.info("ai.agent.provider_unavailable", reason=str(exc))
            return AgentResult(
                reply=str(exc),
                provider_available=False,
                tool_calls_made=tool_calls_made,
            )
        except ProviderError as exc:
            logger.warning("ai.agent.provider_error", error=str(exc))
            return AgentResult(
                reply=f"The AI provider returned an error: {exc}",
                provider_available=True,
                tool_calls_made=tool_calls_made,
                input_tokens=total_input,
                output_tokens=total_output,
            )

        # Should not reach here (loop always returns or raises).
        return AgentResult(
            reply="An unexpected error occurred.",
            provider_available=True,
            tool_calls_made=tool_calls_made,
        )

    async def _execute_tool(
        self,
        tc: ToolCall,
        db: AsyncSession,
        user: CurrentUser,
    ) -> dict:
        """Validate args and execute a single tool call.

        Security: permission and tenant checks are enforced here.
        Invalid args produce an error dict (not an exception) so the model
        can explain the failure to the user.
        """
        td = tool_registry.get(tc.name)

        # Unknown tool — never execute.
        if td is None:
            logger.warning("ai.tool.unknown", name=tc.name)
            return {"error": f"Tool {tc.name!r} is not registered."}

        # Permission check — authoritative from DB, never from model claims.
        missing = [p for p in td.required_permissions if p not in user.permissions]
        if missing:
            logger.warning(
                "ai.tool.permission_denied", name=tc.name, missing=missing
            )
            return {"error": f"Permission denied for tool {tc.name!r}."}

        # Write tools must never reach here without explicit confirmation.
        if td.write:
            logger.error(
                "ai.tool.write_tool_called_without_confirmation",
                name=tc.name,
            )
            return {"error": "Write operation requires explicit user confirmation."}

        # Validate arguments with Pydantic (inline import to avoid circular).
        try:
            result = await td.executor(tc.arguments, db, user)
        except PydanticValidationError as exc:
            logger.info("ai.tool.invalid_args", name=tc.name, errors=exc.error_count())
            return {"error": f"Invalid arguments for tool {tc.name!r}: {exc.errors(include_url=False)}"}
        except Exception as exc:  # noqa: BLE001
            logger.warning("ai.tool.execution_error", name=tc.name, exc_type=type(exc).__name__)
            return {"error": f"Tool {tc.name!r} failed: {type(exc).__name__}"}

        return result

    async def _execute_confirmed_action(
        self,
        *,
        confirmed_action: "ConfirmedAction",
        wire_messages: list[ProviderMessage],
        db: AsyncSession,
        user: CurrentUser,
    ) -> AgentResult:
        """Execute a write tool call that the user has explicitly confirmed."""
        td = tool_registry.get(confirmed_action.tool_name)
        if td is None or not td.write:
            return AgentResult(
                reply="The confirmed action is no longer valid.",
                provider_available=True,
                tool_calls_made=[],
            )

        # Re-check permissions at execution time — user may have lost access.
        missing = [p for p in td.required_permissions if p not in user.permissions]
        if missing:
            return AgentResult(
                reply="You no longer have permission to perform this action.",
                provider_available=True,
                tool_calls_made=[],
            )

        try:
            result = await td.executor(confirmed_action.tool_arguments, db, user)
        except PydanticValidationError:
            return AgentResult(
                reply="The action could not be completed: invalid arguments.",
                provider_available=True,
                tool_calls_made=[],
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "ai.confirmed_action.error",
                tool=confirmed_action.tool_name,
                exc_type=type(exc).__name__,
            )
            return AgentResult(
                reply=f"The action failed: {type(exc).__name__}.",
                provider_available=True,
                tool_calls_made=[confirmed_action.tool_name],
            )

        # Let the model summarize the result to the user.
        summary_messages: list[ProviderMessage] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"The following action was just confirmed and executed:\n"
                    f"Tool: {confirmed_action.tool_name}\n"
                    f"Arguments: {json.dumps(confirmed_action.tool_arguments)}\n"
                    f"Result: {json.dumps(result)}\n\n"
                    "Please summarize what happened in a single, clear sentence."
                ),
            },
        ]
        try:
            response = await self._provider.complete(summary_messages, [])
            reply = response.content or f"Action completed: {json.dumps(result)}"
        except (ProviderError, ProviderUnavailableError):
            reply = f"Action completed: {json.dumps(result)}"

        return AgentResult(
            reply=reply,
            provider_available=True,
            tool_calls_made=[confirmed_action.tool_name],
        )


@dataclass
class ConfirmedAction:
    tool_name: str
    tool_arguments: dict


# ---------------------------------------------------------------------------
# Singleton factory
# ---------------------------------------------------------------------------

def get_orchestrator() -> AgentOrchestrator:
    """Returns an orchestrator using the default registered provider."""
    from app.services.ai_provider import ProviderRegistry
    return AgentOrchestrator(provider=ProviderRegistry.default())

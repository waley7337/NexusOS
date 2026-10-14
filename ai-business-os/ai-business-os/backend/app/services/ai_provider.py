"""AI provider abstraction — isolates model-provider specifics from agent logic.

Architecture:
  BaseAIProvider   — protocol / interface (subclass to add new providers)
  OpenAIProvider   — OpenAI chat-completions implementation (1.x SDK)
  ProviderRegistry — singleton registry so agent code never imports OpenAI directly

Design goals:
  * Provider-independent: switching from OpenAI to Anthropic (or a local model)
    only requires implementing BaseAIProvider and registering it; no agent logic
    changes.
  * No secrets in tracebacks: API keys are never embedded in exception messages.
  * Fail-closed on misconfiguration: missing key → ProviderUnavailable, not crash.
  * Async throughout: uses AsyncOpenAI for native asyncio compatibility.
  * Configurable limits: model, timeout, and iteration caps from Settings.
"""
from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger("app.ai.provider")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ToolCall:
    """A tool invocation requested by the model."""
    id: str           # provider-assigned call id — echoed back in tool result
    name: str         # function name (must match a registered tool)
    arguments: dict   # already-parsed JSON dict


@dataclass
class AssistantMessage:
    """Final or intermediate text from the model (may be empty when tool calls requested)."""
    content: str | None
    tool_calls: list[ToolCall] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    @property
    def requests_tools(self) -> bool:
        return bool(self.tool_calls)


@dataclass
class ToolResultMessage:
    """Tool execution result fed back to the model."""
    tool_call_id: str
    content: str  # JSON-serialised result or error description


# Conversation message types the provider accepts.
ProviderMessage = dict[str, Any]


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ProviderUnavailableError(RuntimeError):
    """Raised when the provider cannot be used (missing key, etc.)."""


class ProviderError(RuntimeError):
    """Raised for recoverable provider-side errors (timeouts, rate limits, etc.)."""


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class BaseAIProvider(ABC):
    """Protocol every provider adapter must satisfy."""

    @abstractmethod
    async def complete(
        self,
        messages: list[ProviderMessage],
        tools: list[dict],
        *,
        temperature: float = 0.3,
    ) -> AssistantMessage:
        """Send *messages* to the model and return its response.

        Args:
            messages:    Conversation history in provider-wire format.
            tools:       OpenAI-style tool definitions (empty list = no tools).
            temperature: Sampling temperature; 0.3 default for business tasks.

        Raises:
            ProviderUnavailableError: Key/config missing.
            ProviderError:            Provider returned an error.
        """

    @abstractmethod
    def is_available(self) -> bool:
        """True if the provider is configured and ready."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Identifier of the underlying model (for metadata / display)."""


# ---------------------------------------------------------------------------
# OpenAI implementation
# ---------------------------------------------------------------------------

class OpenAIProvider(BaseAIProvider):
    """OpenAI chat-completions (SDK 1.x, AsyncOpenAI)."""

    def __init__(
        self,
        api_key: str | None,
        model: str,
        timeout: float,
        max_tokens: int = 2000,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._max_tokens = max_tokens

    def is_available(self) -> bool:
        return bool(self._api_key)

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(
        self,
        messages: list[ProviderMessage],
        tools: list[dict],
        *,
        temperature: float = 0.3,
    ) -> AssistantMessage:
        if not self.is_available():
            raise ProviderUnavailableError(
                "OPENAI_API_KEY is not configured. "
                "Set it in the deployment environment to enable AI responses."
            )

        from openai import AsyncOpenAI
        from openai import APIError, APITimeoutError, RateLimitError

        client = AsyncOpenAI(api_key=self._api_key, timeout=self._timeout)

        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": self._max_tokens,
            "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        try:
            response = await client.chat.completions.create(**kwargs)
        except APITimeoutError as exc:
            logger.warning("ai.provider.timeout", model=self._model, timeout=self._timeout)
            raise ProviderError("Request to AI provider timed out.") from exc
        except RateLimitError as exc:
            logger.warning("ai.provider.rate_limit", model=self._model)
            raise ProviderError("AI provider rate limit reached. Try again shortly.") from exc
        except APIError as exc:
            # Never include status/message from the provider — may contain
            # request-specific details that leak operational information.
            logger.warning("ai.provider.api_error", model=self._model, exc_type=type(exc).__name__)
            raise ProviderError(f"AI provider error ({type(exc).__name__}).") from exc

        choice = response.choices[0]
        message = choice.message

        tool_calls: list[ToolCall] = []
        if message.tool_calls:
            for tc in message.tool_calls:
                try:
                    args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    args = {}
                tool_calls.append(ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=args,
                ))

        usage = response.usage
        return AssistantMessage(
            content=message.content,
            tool_calls=tool_calls,
            input_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
        )


# ---------------------------------------------------------------------------
# Provider registry
# ---------------------------------------------------------------------------

class ProviderRegistry:
    """Maps provider names to instances. Configured lazily from Settings."""

    _providers: dict[str, BaseAIProvider] = {}

    @classmethod
    def register(cls, name: str, provider: BaseAIProvider) -> None:
        cls._providers[name] = provider

    @classmethod
    def get(cls, name: str = "openai") -> BaseAIProvider:
        if name not in cls._providers:
            raise KeyError(f"AI provider {name!r} is not registered.")
        return cls._providers[name]

    @classmethod
    def default(cls) -> BaseAIProvider:
        return cls.get("openai")


def setup_providers() -> None:
    """Called at application startup to register configured providers."""
    from app.core.config import settings

    ProviderRegistry.register(
        "openai",
        OpenAIProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_MODEL,
            timeout=float(settings.AI_REQUEST_TIMEOUT_SECONDS),
        ),
    )

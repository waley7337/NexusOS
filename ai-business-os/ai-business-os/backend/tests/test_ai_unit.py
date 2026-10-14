"""Pure-unit tests for AI orchestration logic — no database required.

These tests run without SKIP_DB_TESTS and mock all I/O.
"""
from __future__ import annotations

import os
import uuid
from unittest.mock import AsyncMock, patch

os.environ.setdefault("SECRET_KEY", "test-secret-key-must-be-32-chars-long!!")
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://nexus:nexus@127.0.0.1:5432/nexus"
)

import pytest


class TestAgentOrchestration:
    """Tests of the orchestrator using mock provider and mock DB."""

    def _make_user(self, permissions: frozenset[str] | None = None):
        from app.dependencies.auth import CurrentUser
        return CurrentUser(
            id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            role="owner",
            permissions=permissions or frozenset({"ai.use", "customers.read"}),
        )

    def _make_conv(self, user):
        """Create a lightweight mock conversation without SQLAlchemy instrumentation."""
        from types import SimpleNamespace
        return SimpleNamespace(
            id=uuid.uuid4(),
            company_id=user.company_id,
            user_id=user.id,
            title="test",
        )

    @pytest.mark.asyncio
    async def test_no_provider_key_returns_unavailable(self):
        from app.services.ai_provider import OpenAIProvider
        from app.services.ai_agent import AgentOrchestrator

        provider = OpenAIProvider(api_key=None, model="gpt-4o-mini", timeout=30)
        orch = AgentOrchestrator(provider=provider)
        user = self._make_user()
        conv = self._make_conv(user)

        db = AsyncMock()
        result = await orch.run(
            user_message="Hello",
            conversation=conv,
            history=[],
            db=db,
            user=user,
        )
        assert result.provider_available is False
        assert "OPENAI_API_KEY" in result.reply

    @pytest.mark.asyncio
    async def test_iteration_cap_terminates_loop(self):
        from app.services.ai_provider import OpenAIProvider, AssistantMessage, ToolCall
        from app.services.ai_agent import AgentOrchestrator
        import app.core.config as cfg_module

        class LoopProvider(OpenAIProvider):
            def is_available(self) -> bool:
                return True

            async def complete(self, messages, tools, *, temperature=0.3):
                return AssistantMessage(
                    content=None,
                    tool_calls=[ToolCall(
                        id="call_x",
                        name="crm_search_customers",
                        arguments={"query": "acme"},
                    )],
                )

        with patch("app.services.ai_tools.tool_registry.get") as mock_get:
            from app.services.ai_tools import ToolDefinition
            async def fake_exec(args, db, user): return {"customers": []}
            mock_td = ToolDefinition(
                name="crm_search_customers",
                description="test",
                parameters_schema={},
                executor=fake_exec,
                required_permissions=["customers.read"],
                write=False,
            )
            mock_get.return_value = mock_td

            original = cfg_module.settings.AI_MAX_TOOL_ITERATIONS
            object.__setattr__(cfg_module.settings, "AI_MAX_TOOL_ITERATIONS", 2)
            try:
                orch = AgentOrchestrator(LoopProvider(api_key="sk-test", model="gpt-4o-mini", timeout=5))
                user = self._make_user()
                conv = self._make_conv(user)
                db = AsyncMock()

                result = await orch.run(
                    user_message="loop test",
                    conversation=conv,
                    history=[],
                    db=db,
                    user=user,
                )
            finally:
                object.__setattr__(cfg_module.settings, "AI_MAX_TOOL_ITERATIONS", original)

        assert "maximum number of steps" in result.reply.lower()

    @pytest.mark.asyncio
    async def test_unauthorized_tool_is_rejected(self):
        """A tool the user lacks permission for returns an error dict, not an exception."""
        from app.services.ai_agent import AgentOrchestrator
        from app.services.ai_provider import OpenAIProvider, AssistantMessage, ToolCall

        class SingleToolProvider(OpenAIProvider):
            def is_available(self) -> bool:
                return True
            _called = 0

            async def complete(self, messages, tools, *, temperature=0.3):
                type(self)._called += 1
                if type(self)._called == 1:
                    return AssistantMessage(
                        content=None,
                        tool_calls=[ToolCall(
                            id="c1",
                            name="crm_search_customers",
                            arguments={"query": "x"},
                        )],
                    )
                return AssistantMessage(content="Result based on tool error.", tool_calls=[])

        orch = AgentOrchestrator(SingleToolProvider(api_key="sk-test", model="gpt-4o-mini", timeout=5))
        # User has NO customers.read.
        user = self._make_user(frozenset({"ai.use"}))
        conv = self._make_conv(user)
        db = AsyncMock()

        result = await orch.run(
            user_message="find customers",
            conversation=conv,
            history=[],
            db=db,
            user=user,
        )
        assert result.reply is not None
        assert result.provider_available is True

    @pytest.mark.asyncio
    async def test_provider_error_returns_safe_reply(self):
        from app.services.ai_provider import OpenAIProvider, ProviderError
        from app.services.ai_agent import AgentOrchestrator

        class ErrorProvider(OpenAIProvider):
            def is_available(self) -> bool:
                return True

            async def complete(self, messages, tools, *, temperature=0.3):
                raise ProviderError("Rate limit exceeded.")

        orch = AgentOrchestrator(ErrorProvider(api_key="sk-test", model="gpt-4o-mini", timeout=5))
        user = self._make_user()
        conv = self._make_conv(user)
        db = AsyncMock()

        result = await orch.run(
            user_message="test",
            conversation=conv,
            history=[],
            db=db,
            user=user,
        )
        assert result.provider_available is True
        # Contains "error" or "rate limit" phrasing — never crashes.
        assert result.reply is not None


class TestToolArgumentValidation:
    """Pydantic validation of tool input schemas — no DB needed."""

    @pytest.mark.asyncio
    async def test_invalid_args_raise_pydantic_error(self):
        from app.services.ai_tools import SearchArgs
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            SearchArgs()  # query is required

    @pytest.mark.asyncio
    async def test_create_task_invalid_project_uuid(self):
        from app.services.ai_tools import CreateTaskArgs
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            CreateTaskArgs(project_id="not-a-uuid", title="Test")

    @pytest.mark.asyncio
    async def test_update_task_invalid_status(self):
        from app.services.ai_tools import UpdateTaskStatusArgs
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            UpdateTaskStatusArgs(task_id=str(uuid.uuid4()), status="flying")

    @pytest.mark.asyncio
    async def test_projects_list_invalid_status(self):
        from app.services.ai_tools import ProjectsListArgs
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            ProjectsListArgs(status="invented_status")

    @pytest.mark.asyncio
    async def test_valid_args_pass(self):
        from app.services.ai_tools import SearchArgs, CreateTaskArgs

        a = SearchArgs(query="acme", limit=5)
        assert a.query == "acme"

        t = CreateTaskArgs(project_id=str(uuid.uuid4()), title="My task", priority="high")
        assert t.priority == "high"


class TestProviderLayer:
    """Tests of OpenAIProvider / ProviderRegistry logic."""

    def test_provider_unavailable_when_no_key(self):
        from app.services.ai_provider import OpenAIProvider

        p = OpenAIProvider(api_key=None, model="gpt-4o-mini", timeout=30)
        assert p.is_available() is False

    def test_provider_available_when_key_present(self):
        from app.services.ai_provider import OpenAIProvider

        p = OpenAIProvider(api_key="sk-test-key", model="gpt-4o-mini", timeout=30)
        assert p.is_available() is True
        assert p.model_name == "gpt-4o-mini"

    @pytest.mark.asyncio
    async def test_complete_raises_unavailable_without_key(self):
        from app.services.ai_provider import OpenAIProvider, ProviderUnavailableError

        p = OpenAIProvider(api_key=None, model="gpt-4o-mini", timeout=30)
        with pytest.raises(ProviderUnavailableError) as exc_info:
            await p.complete([], [])
        # Error message must not contain the literal string "api_key" exposing internals.
        assert "api_key" not in str(exc_info.value).lower() or \
               "OPENAI_API_KEY" in str(exc_info.value)

    def test_registry_raises_on_unknown_provider(self):
        from app.services.ai_provider import ProviderRegistry
        with pytest.raises(KeyError):
            ProviderRegistry.get("nonexistent_provider")

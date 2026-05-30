"""PROJ-29 Phase 1D Round 1D-3 — per-tool Langfuse span emission.

Covers (AC-Ops-Obs-1):
- ``_with_langfuse_span`` wraps a callable and emits ``logger.info`` with
  input + output_preview + duration_ms.
- When ``get_langfuse_handler`` returns ``None`` (no creds), the wrapped
  function still runs successfully without crashes — the only telemetry
  side-effect is the structured log line.
- Tool execution captures non-zero duration_ms.
- Exceptions in the wrapped function propagate AFTER logging.
"""

from __future__ import annotations

import logging
from unittest.mock import patch


class TestLangfuseSpanDecorator:
    def test_runs_when_handler_is_none(self, caplog):
        """No Langfuse creds -> ``get_langfuse_handler`` returns None,
        wrapped fn still runs + emits the log line."""
        from agent_app.agents.niche_chat_agent import _with_langfuse_span

        @_with_langfuse_span('test_tool')
        def _run() -> dict:
            return {'ok': True}

        with patch(
            'core.observability.langfuse_handler.get_langfuse_handler',
            return_value=None,
        ), caplog.at_level(logging.INFO, logger='agent_app.agents.niche_chat_agent'):
            result = _run()

        assert result == {'ok': True}
        # Span log line emitted with tool name in extras.
        span_records = [
            r for r in caplog.records
            if r.message == 'langfuse_tool_span'
        ]
        assert len(span_records) >= 1
        assert span_records[0].tool == 'test_tool'

    def test_captures_duration_ms(self, caplog):
        from agent_app.agents.niche_chat_agent import _with_langfuse_span
        import time

        @_with_langfuse_span('slow_tool')
        def _slow() -> str:
            time.sleep(0.05)
            return 'done'

        with patch(
            'core.observability.langfuse_handler.get_langfuse_handler',
            return_value=None,
        ), caplog.at_level(logging.INFO, logger='agent_app.agents.niche_chat_agent'):
            _slow()

        span_records = [
            r for r in caplog.records
            if r.message == 'langfuse_tool_span'
        ]
        assert span_records
        # duration_ms should reflect the 50ms sleep with reasonable jitter.
        assert span_records[0].duration_ms >= 40

    def test_exception_propagates_after_logging(self, caplog):
        from agent_app.agents.niche_chat_agent import _with_langfuse_span
        import pytest

        @_with_langfuse_span('failing_tool')
        def _fail() -> str:
            raise RuntimeError('boom')

        with patch(
            'core.observability.langfuse_handler.get_langfuse_handler',
            return_value=None,
        ), caplog.at_level(logging.INFO, logger='agent_app.agents.niche_chat_agent'):
            with pytest.raises(RuntimeError, match='boom'):
                _fail()

        # Log line was emitted before the raise propagated.
        span_records = [
            r for r in caplog.records
            if r.message == 'langfuse_tool_span'
        ]
        assert span_records
        assert span_records[0].error == 'boom'

    def test_handler_init_failure_does_not_crash_tool(self, caplog):
        """Even if get_langfuse_handler() raises, the tool must still run."""
        from agent_app.agents.niche_chat_agent import _with_langfuse_span

        @_with_langfuse_span('test_tool')
        def _run() -> dict:
            return {'ok': True}

        with patch(
            'core.observability.langfuse_handler.get_langfuse_handler',
            side_effect=RuntimeError('langfuse init exploded'),
        ), caplog.at_level(logging.INFO, logger='agent_app.agents.niche_chat_agent'):
            result = _run()

        assert result == {'ok': True}


class TestSafeRepr:
    def test_truncates_to_limit(self):
        from agent_app.agents.niche_chat_agent import _safe_repr

        out = _safe_repr('x' * 1000, limit=50)
        assert len(out) <= 51  # 50 + '…'
        assert out.endswith('…')

    def test_short_value_passthrough(self):
        from agent_app.agents.niche_chat_agent import _safe_repr

        out = _safe_repr('hi')
        assert out == "'hi'"


class TestToolsEmitSpan:
    """Smoke: invoking each of the 8 tools emits a tool-span log entry.

    We use lightweight stubs for the heavy dependencies so we focus on the
    decorator emission path, not the tool semantics.
    """

    def _patch_handler_none(self):
        return patch(
            'core.observability.langfuse_handler.get_langfuse_handler',
            return_value=None,
        )

    def test_web_search_emits_span(self, caplog, db):
        from django.contrib.auth import get_user_model

        from agent_app.agents.niche_chat_agent import _build_tools
        from niche_app.models import Niche
        from workspace_app.models import Workspace

        User = get_user_model()
        user = User.objects.create_user(email='tls-ws@test.com', password='pw')
        ws = Workspace.objects.create(name='WS', slug='tls-ws', owner=user)
        niche = Niche.objects.create(
            name='Fishing', workspace=ws, created_by=user,
        )

        with patch(
            'search_app.services.vane_service.VaneService.search_collected',
            return_value={'sources': [], 'answer': '', 'model_used': ''},
        ), self._patch_handler_none(), caplog.at_level(
            logging.INFO, logger='agent_app.agents.niche_chat_agent',
        ):
            tools = _build_tools(ws, niche)
            web_search = next(t for t in tools if t.name == 'web_search')
            web_search.invoke({'query': 'fishing'})

        span_records = [
            r for r in caplog.records
            if r.message == 'langfuse_tool_span'
            and getattr(r, 'tool', None) == 'web_search'
        ]
        assert span_records, 'expected web_search to emit a tool-span log entry'

    def test_bsr_stats_emits_span_on_empty_niche(self, caplog, db):
        from django.contrib.auth import get_user_model

        from agent_app.agents.niche_chat_agent import _build_tools
        from niche_app.models import Niche
        from workspace_app.models import Workspace

        User = get_user_model()
        user = User.objects.create_user(email='tls-bsr@test.com', password='pw')
        ws = Workspace.objects.create(name='WS', slug='tls-bsr', owner=user)
        niche = Niche.objects.create(
            name='Hiking', workspace=ws, created_by=user,
        )

        with self._patch_handler_none(), caplog.at_level(
            logging.INFO, logger='agent_app.agents.niche_chat_agent',
        ):
            tools = _build_tools(ws, niche)
            bsr_stats = next(t for t in tools if t.name == 'bsr_stats')
            result = bsr_stats.invoke({})

        assert result['count'] == 0
        span_records = [
            r for r in caplog.records
            if r.message == 'langfuse_tool_span'
            and getattr(r, 'tool', None) == 'bsr_stats'
        ]
        assert span_records

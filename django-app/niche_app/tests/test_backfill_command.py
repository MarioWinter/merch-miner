"""PROJ-34 Phase 13c.8 / AC-57 — Tests for the `backfill_niche_builder_hints`
management command.

Covers:
- dry-run lists candidates but never calls the LLM
- real run calls the structurer once per candidate
- `--workspace-id` filter restricts the iteration set
- per-niche failure does not abort the batch
- `--limit` caps the number of niches processed
"""

from __future__ import annotations

from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.utils import timezone

from niche_app.models import Niche
from niche_research_app.models import NicheResearch
from user_auth_app.models import User
from workspace_app.models import Membership, Workspace

pytestmark = pytest.mark.django_db


def _make_workspace(email, slug='ws'):
    user = User.objects.create_user(
        email=email, password='pw', username=email,
    )
    workspace = Workspace.objects.create(name=slug, slug=slug, owner=user)
    Membership.objects.create(
        workspace=workspace, user=user, role='admin', status='active',
    )
    return workspace, user


def _make_niche(workspace, user, name, *, with_completed_research=True, hints=None):
    niche = Niche.objects.create(
        workspace=workspace, name=name, created_by=user,
        builder_form_hints=hints,
    )
    if with_completed_research:
        NicheResearch.objects.create(
            niche=niche,
            status=NicheResearch.Status.COMPLETED,
            triggered_by=user,
            completed_at=timezone.now(),
        )
    return niche


class TestBackfillCommand:
    @patch('niche_app.management.commands.backfill_niche_builder_hints.time.sleep')
    @patch(
        'niche_app.management.commands.backfill_niche_builder_hints.'
        'structure_niche_for_builder',
    )
    def test_dry_run_lists_candidates_without_llm(
        self, mock_structurer, _sleep,
    ):
        workspace, user = _make_workspace('dry@example.com', slug='ws-dry')
        _make_niche(workspace, user, 'Has Research 1')
        _make_niche(workspace, user, 'Has Research 2')
        _make_niche(workspace, user, 'No Research', with_completed_research=False)

        out = StringIO()
        call_command('backfill_niche_builder_hints', '--dry-run', stdout=out)

        assert '2 candidate(s)' in out.getvalue()
        mock_structurer.assert_not_called()

    @patch('niche_app.management.commands.backfill_niche_builder_hints.time.sleep')
    @patch(
        'niche_app.management.commands.backfill_niche_builder_hints.'
        'structure_niche_for_builder',
    )
    def test_real_run_calls_structurer_for_each(
        self, mock_structurer, _sleep,
    ):
        workspace, user = _make_workspace('real@example.com', slug='ws-real')
        n1 = _make_niche(workspace, user, 'A')
        n2 = _make_niche(workspace, user, 'B')
        _make_niche(workspace, user, 'NoResearch', with_completed_research=False)
        mock_structurer.return_value = {'spatial': 'vertical_stack'}

        out = StringIO()
        call_command('backfill_niche_builder_hints', stdout=out)

        assert mock_structurer.call_count == 2
        called_ids = {c.args[0] for c in mock_structurer.call_args_list}
        assert called_ids == {n1.id, n2.id}

    @patch('niche_app.management.commands.backfill_niche_builder_hints.time.sleep')
    @patch(
        'niche_app.management.commands.backfill_niche_builder_hints.'
        'structure_niche_for_builder',
    )
    def test_workspace_filter(self, mock_structurer, _sleep):
        ws_a, user_a = _make_workspace('a@example.com', slug='ws-a')
        ws_b, user_b = _make_workspace('b@example.com', slug='ws-b')
        _make_niche(ws_a, user_a, 'A1')
        _make_niche(ws_a, user_a, 'A2')
        _make_niche(ws_b, user_b, 'B1')
        mock_structurer.return_value = {'spatial': 'vertical_stack'}

        out = StringIO()
        call_command(
            'backfill_niche_builder_hints',
            '--workspace-id', str(ws_a.id),
            stdout=out,
        )

        assert mock_structurer.call_count == 2

    @patch('niche_app.management.commands.backfill_niche_builder_hints.time.sleep')
    @patch(
        'niche_app.management.commands.backfill_niche_builder_hints.'
        'structure_niche_for_builder',
    )
    def test_per_niche_failure_continues(self, mock_structurer, _sleep):
        workspace, user = _make_workspace('fail@example.com', slug='ws-fail')
        _make_niche(workspace, user, 'A')
        _make_niche(workspace, user, 'B')
        mock_structurer.side_effect = [
            RuntimeError('boom on first'),
            {'spatial': 'vertical_stack'},
        ]

        out = StringIO()
        err = StringIO()
        call_command(
            'backfill_niche_builder_hints', stdout=out, stderr=err,
        )

        assert mock_structurer.call_count == 2
        # Failure landed on stderr, but command exited cleanly (no CommandError).
        assert 'FAIL' in err.getvalue()
        assert 'success=1' in out.getvalue()
        assert 'failure=1' in out.getvalue()

    @patch('niche_app.management.commands.backfill_niche_builder_hints.time.sleep')
    @patch(
        'niche_app.management.commands.backfill_niche_builder_hints.'
        'structure_niche_for_builder',
    )
    def test_limit_flag(self, mock_structurer, _sleep):
        workspace, user = _make_workspace('limit@example.com', slug='ws-limit')
        for index in range(5):
            _make_niche(workspace, user, f'N{index}')
        mock_structurer.return_value = {'spatial': 'vertical_stack'}

        out = StringIO()
        call_command(
            'backfill_niche_builder_hints', '--limit', '2', stdout=out,
        )

        assert mock_structurer.call_count == 2

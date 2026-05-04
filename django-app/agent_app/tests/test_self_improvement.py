"""Phase 14 — Self-Improvement Layer (Metis Pattern) tests.

Covers AC-65/66/67/68/71/72/73/74/75 + EC-18/19/20/21/22/23.

LLM mocking strategy:
    - For ``user_profile_service.run_dialectic`` we patch the
      module-level ``_llm_dialectic_pass`` symbol — the seam is documented
      in the service docstring.
    - For ``reflection_service.run_reflection`` we don't need to mock the
      LLM directly: the deterministic ``_summarize_session`` runs without
      any LLM call. We only mock the LLM when we want to verify dialectic
      behavior (EC-20).

Vector DB mocking strategy:
    - ``conftest.disable_embedding_signals`` already patches
      ``vector_app.signals._enqueue_create / _delete``, so post_save
      signals do not actually enqueue jobs.
    - For tests that need to verify ``EmbeddingService`` calls are issued
      (Skill embedding lifecycle), we patch the import inside
      ``skill_manager`` directly.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    AgentSession,
    AgentWorkspaceConfig,
    DEFAULT_MEMORY_CHAR_LIMIT,
    DEFAULT_PROFILE_CHAR_LIMIT,
    MessageRole,
    SessionStatus,
    Skill,
    SkillTriggerType,
    SkillVersion,
    UserProfile,
    WorkspaceMemory,
)

pytestmark = pytest.mark.django_db


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='self_improve@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership
    return Membership.objects.get(user=user, status='active').workspace


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def completed_session(workspace, user):
    return AgentSession.objects.create(
        workspace=workspace,
        created_by=user,
        title='Reflection target',
        status=SessionStatus.COMPLETED,
        completed_at=timezone.now(),
        completed_steps=3,
        total_steps=3,
    )


# ═══════════════════════════════════════════════════════════════════════════
#  AC-65/68 + EC-22 — Skill CRUD + soft delete + Vector DB embedding lifecycle
# ═══════════════════════════════════════════════════════════════════════════


class TestSkillEmbeddingLifecycle:
    """Skill CRUD + soft-delete + Vector DB embedding side effects."""

    def test_create_skill_persists_initial_version(self, workspace, user):
        from agent_app.services.skill_manager import create_skill

        skill = create_skill(
            workspace=workspace,
            name='Niche-research follow-up',
            description='Steps to refine a niche after deep research',
            content_md='1. Trim outliers\n2. Re-rank\n',
            applicable_agent_types=['research'],
            created_by=user,
            patch_summary='Initial create',
        )
        assert skill.version == 1
        assert skill.deleted_at is None
        # SkillVersion snapshot is created at v=1 with "Initial version" rationale
        versions = list(SkillVersion.objects.filter(skill=skill))
        assert len(versions) == 1
        assert versions[0].version == 1
        assert versions[0].patch_summary == 'Initial create'

    def test_soft_delete_sets_deleted_at_and_drops_embedding(
        self, workspace, user,
    ):
        from django.test import TestCase

        from agent_app.services.skill_manager import (
            create_skill,
            soft_delete_skill,
        )

        skill = create_skill(
            workspace=workspace,
            name='X',
            description='',
            content_md='body',
            created_by=user,
        )
        # Spy on EmbeddingService.delete_embedding_by_ref via the import
        # site inside soft_delete_skill. Use captureOnCommitCallbacks so
        # the transaction.on_commit closure is actually fired even though
        # pytest-django wraps the test in a transaction.
        fake_service = MagicMock()
        tc = TestCase()
        with patch(
            'vector_app.services.EmbeddingService',
            return_value=fake_service,
        ):
            with tc.captureOnCommitCallbacks(execute=True):
                ok = soft_delete_skill(skill_id=str(skill.pk))
        assert ok is True
        skill.refresh_from_db()
        assert skill.deleted_at is not None
        # delete_embedding_by_ref was called for this skill
        assert fake_service.delete_embedding_by_ref.called

    def test_find_relevant_skills_excludes_soft_deleted(
        self, workspace, user,
    ):
        """EC-22 — soft-deleted skills are not returned by find_relevant_skills."""
        from agent_app.services.skill_manager import (
            create_skill,
            find_relevant_skills,
            soft_delete_skill,
        )

        active = create_skill(
            workspace=workspace, name='Active skill',
            description='', content_md='active body',
            applicable_agent_types=['research'], created_by=user,
        )
        deleted = create_skill(
            workspace=workspace, name='Deleted skill',
            description='', content_md='deleted body',
            applicable_agent_types=['research'], created_by=user,
        )

        # Vector search disabled (no vector_app config in tests) → falls
        # back to recency-ordered queryset filtered by deleted_at IS NULL.
        with patch(
            'vector_app.services.EmbeddingService',
        ) as cls:
            cls.return_value.search.return_value = []
            results = find_relevant_skills(
                workspace=workspace, agent_type='research',
                task_description='build me research', k=5,
            )
        ids = {r['id'] for r in results}
        assert str(active.pk) in ids
        assert str(deleted.pk) in ids

        # After soft-delete the deleted skill must vanish from results.
        soft_delete_skill(skill_id=str(deleted.pk))
        with patch(
            'vector_app.services.EmbeddingService',
        ) as cls:
            cls.return_value.search.return_value = []
            results = find_relevant_skills(
                workspace=workspace, agent_type='research',
                task_description='build me research', k=5,
            )
        ids = {r['id'] for r in results}
        assert str(active.pk) in ids
        assert str(deleted.pk) not in ids


# ═══════════════════════════════════════════════════════════════════════════
#  AC-66 + EC-18 — WorkspaceMemory char-limit enforcement
# ═══════════════════════════════════════════════════════════════════════════


class TestWorkspaceMemoryCharLimit:
    """Char-limit is enforced at the view layer using
    ``AgentWorkspaceConfig.memory_char_limit`` (admin-tunable). The model
    no longer hard-caps the column so that an admin who raises the limit
    is not blocked by stale model-level validators.
    """

    def test_view_rejects_over_default_limit(self, api_client, workspace):
        """View-layer enforcement at the default limit (2200)."""
        url = '/api/agent/memory/'
        resp = api_client.patch(url, {
            'content_md': 'x' * (DEFAULT_MEMORY_CHAR_LIMIT + 1),
        }, format='json')
        assert resp.status_code == 400
        assert resp.data['error'] == 'memory_char_limit_exceeded'
        assert resp.data['limit'] == DEFAULT_MEMORY_CHAR_LIMIT

    def test_at_limit_is_allowed(self, api_client, workspace):
        """At-limit content is accepted by the view."""
        url = '/api/agent/memory/'
        resp = api_client.patch(url, {
            'content_md': 'x' * DEFAULT_MEMORY_CHAR_LIMIT,
        }, format='json')
        assert resp.status_code == 200, resp.data

    def test_model_full_clean_no_longer_blocks_over_default(self, workspace):
        """The DB-level column constraint was removed — ``full_clean`` no
        longer raises for content over the default. This is required so
        that an admin-raised limit (e.g. 4000) is not silently rejected
        at the model layer.
        """
        mem = WorkspaceMemory(
            workspace=workspace,
            content_md='x' * (DEFAULT_MEMORY_CHAR_LIMIT + 500),
        )
        # Must not raise — char-limit enforcement is the view's job.
        mem.full_clean()


# ═══════════════════════════════════════════════════════════════════════════
#  AC-67/AC-70 + EC-20 — UserProfile char-limit + dialectic 3-pass
# ═══════════════════════════════════════════════════════════════════════════


class TestUserProfileDialectic:
    def test_profile_view_rejects_over_default_limit(
        self, api_client, workspace, user,
    ):
        """View-layer enforcement using AgentWorkspaceConfig.profile_char_limit."""
        url = '/api/agent/profile/'
        resp = api_client.patch(url, {
            'content_md': 'y' * (DEFAULT_PROFILE_CHAR_LIMIT + 1),
        }, format='json')
        assert resp.status_code == 400
        assert resp.data['error'] == 'profile_char_limit_exceeded'

    def test_profile_full_clean_no_longer_blocks_over_default(
        self, workspace, user,
    ):
        """DB-level cap removed so an admin-raised limit is not blocked."""
        profile = UserProfile(
            workspace=workspace,
            user=user,
            content_md='y' * (DEFAULT_PROFILE_CHAR_LIMIT + 500),
        )
        profile.full_clean()  # must not raise

    def test_dialect_reasoning_unbounded(self, workspace, user):
        """Dialect reasoning is the unbounded scratchpad — no validator."""
        profile = UserProfile.objects.create(
            workspace=workspace, user=user,
            content_md='ok',
            dialect_reasoning='z' * 5000,
        )
        # full_clean must not raise on the scratchpad
        profile.full_clean()
        assert len(profile.dialect_reasoning) == 5000

    def test_run_dialectic_3_passes_consistent_update(
        self, workspace, user, completed_session,
    ):
        """3-pass dialectic produces a content_md update + appended reasoning."""
        from agent_app.services import user_profile_service

        # Mock LLM seam — return predictable text per pass.
        def fake_pass(workspace, user, pass_label, prior_text,
                      user_signals, current_profile_md):
            return {
                'initial': '## Profile\n- comm: terse',
                'audit': '## Profile\n- comm: terse\n- gaps: none',
                'reconcile': '## Profile\n- comm: terse\n- expertise: POD',
            }[pass_label]

        # Add a user signal so dialectic has input.
        AgentMessage.objects.create(
            session=completed_session, role=MessageRole.USER,
            content='Use humor slogans, target adults 25-40.',
        )

        with patch.object(
            user_profile_service, '_llm_dialectic_pass', side_effect=fake_pass,
        ):
            profile = user_profile_service.run_dialectic(
                workspace, user, session_id=str(completed_session.pk),
            )

        assert profile.content_md == '## Profile\n- comm: terse\n- expertise: POD'
        assert 'Pass 1 — Initial' in profile.dialect_reasoning
        assert 'Pass 2 — Audit' in profile.dialect_reasoning
        assert 'Pass 3 — Reconciled' in profile.dialect_reasoning
        assert profile.last_dialectic_at is not None
        # Respects char limit (1375)
        assert len(profile.content_md) <= DEFAULT_PROFILE_CHAR_LIMIT

    def test_run_dialectic_truncates_when_over_limit(
        self, workspace, user, completed_session,
    ):
        """If LLM returns > limit chars, content_md is truncated."""
        from agent_app.services import user_profile_service

        long_text = 'a' * (DEFAULT_PROFILE_CHAR_LIMIT + 500)

        def fake_pass(workspace, user, pass_label, prior_text,
                      user_signals, current_profile_md):
            return long_text

        with patch.object(
            user_profile_service, '_llm_dialectic_pass', side_effect=fake_pass,
        ):
            profile = user_profile_service.run_dialectic(
                workspace, user, session_id=str(completed_session.pk),
            )
        assert len(profile.content_md) <= DEFAULT_PROFILE_CHAR_LIMIT

    def test_ec20_contradiction_reconciliation_produces_coherent_update(
        self, workspace, user, completed_session,
    ):
        """EC-20 — pass 1 says A, pass 3 reconciles with existing → coherent."""
        from agent_app.services import user_profile_service

        # Existing profile asserts X.
        UserProfile.objects.create(
            workspace=workspace, user=user,
            content_md='## Profile\n- preference: morning sessions\n',
        )

        # Pass 1 contradicts the existing profile (says "evening").
        # Pass 3 reconciles — keeps the older invariant.
        passes = {
            'initial': '## Profile\n- preference: evening sessions',
            'audit': '## Profile\n- preference: evening sessions (weak signal)',
            'reconcile': '## Profile\n- preference: morning sessions (existing invariant retained)',
        }

        def fake_pass(workspace, user, pass_label, prior_text,
                      user_signals, current_profile_md):
            return passes[pass_label]

        AgentMessage.objects.create(
            session=completed_session, role=MessageRole.USER,
            content='Tonight test',
        )

        with patch.object(
            user_profile_service, '_llm_dialectic_pass', side_effect=fake_pass,
        ):
            profile = user_profile_service.run_dialectic(
                workspace, user, session_id=str(completed_session.pk),
            )
        # Reconciled output is the final content
        assert 'morning sessions' in profile.content_md
        assert 'invariant retained' in profile.content_md


# ═══════════════════════════════════════════════════════════════════════════
#  AC-71 — auto-creation triggers (A/B/C)
# ═══════════════════════════════════════════════════════════════════════════


class TestAC71AutoCreationTriggers:
    def _make_action_log(self, session, status, action='do_thing'):
        return AgentActionLog.objects.create(
            session=session,
            workspace=session.workspace,
            user=session.created_by,
            agent_type='research',
            action=action,
            status=status,
        )

    def test_trigger_a_complex_task_no_errors(
        self, workspace, user, completed_session,
    ):
        """Trigger A — > 5 tool calls + 0 errors → auto_complex_task skill."""
        from agent_app.services.reflection_service import run_reflection

        # 6 completed actions, 0 failures.
        for _ in range(6):
            self._make_action_log(completed_session, ActionStatus.COMPLETED)

        run_reflection(str(completed_session.pk))

        skills = Skill.objects.filter(
            workspace=workspace,
            trigger_type=SkillTriggerType.AUTO_COMPLEX_TASK,
        )
        assert skills.count() == 1, (
            f'Expected exactly one auto_complex_task skill, got {skills.count()}'
        )
        skill = skills.first()
        assert skill.created_by_session_id == completed_session.pk

    def test_trigger_b_error_recovery(
        self, workspace, user, completed_session,
    ):
        """Trigger B — failed action + final completed session → auto_error_recovery."""
        from agent_app.services.reflection_service import run_reflection

        # One failed action then session reached completed status (fixture).
        self._make_action_log(completed_session, ActionStatus.FAILED)

        run_reflection(str(completed_session.pk))

        skills = Skill.objects.filter(
            workspace=workspace,
            trigger_type=SkillTriggerType.AUTO_ERROR_RECOVERY,
        )
        assert skills.count() == 1
        # Trigger A must NOT fire here (had an error, fewer than 5 tool calls).
        assert not Skill.objects.filter(
            workspace=workspace,
            trigger_type=SkillTriggerType.AUTO_COMPLEX_TASK,
        ).exists()

    def test_trigger_c_user_correction(
        self, workspace, user, completed_session,
    ):
        """Trigger C — rejection + approval_response with content → user_correction."""
        from agent_app.services.reflection_service import run_reflection

        self._make_action_log(completed_session, ActionStatus.REJECTED)
        AgentMessage.objects.create(
            session=completed_session,
            role=MessageRole.APPROVAL_RESPONSE,
            content='Use a softer tone next time.',
        )

        run_reflection(str(completed_session.pk))

        skills = Skill.objects.filter(
            workspace=workspace,
            trigger_type=SkillTriggerType.USER_CORRECTION,
        )
        assert skills.count() == 1


# ═══════════════════════════════════════════════════════════════════════════
#  AC-72 + EC-19 — patch_skill applies, bumps version, version conflict 409
# ═══════════════════════════════════════════════════════════════════════════


class TestAC72PatchSkill:
    def test_patch_bumps_version_and_creates_snapshot(
        self, workspace, user,
    ):
        from agent_app.services.skill_manager import create_skill, patch_skill

        skill = create_skill(
            workspace=workspace, name='Skill', description='',
            content_md='v1 body', created_by=user,
        )
        # Initial state: version=1, one SkillVersion row.
        assert skill.version == 1
        assert SkillVersion.objects.filter(skill=skill).count() == 1

        patched = patch_skill(
            skill_id=str(skill.pk),
            patch_md='v2 body',
            expected_version=1,
            patch_summary='Refine after error',
        )
        assert patched.version == 2
        assert patched.content_md == 'v2 body'

        # Audit chain: v1 (initial create) + v2 (patch).
        versions = SkillVersion.objects.filter(skill=skill).order_by('version')
        assert versions.count() == 2
        assert versions[0].version == 1
        assert versions[0].content_md == 'v1 body'
        assert versions[1].version == 2
        assert versions[1].content_md == 'v2 body'
        assert 'Refine after error' in versions[1].patch_summary

    def test_ec19_version_conflict_raises(self, workspace, user):
        from agent_app.services.skill_manager import (
            VersionConflict,
            create_skill,
            patch_skill,
        )

        skill = create_skill(
            workspace=workspace, name='Skill', description='',
            content_md='v1', created_by=user,
        )
        # First patch with correct version succeeds.
        patch_skill(
            skill_id=str(skill.pk), patch_md='v2',
            expected_version=1, patch_summary='ok',
        )
        # Second patch attempting expected_version=1 again must raise.
        with pytest.raises(VersionConflict) as exc_info:
            patch_skill(
                skill_id=str(skill.pk), patch_md='v3',
                expected_version=1,
            )
        assert exc_info.value.current_version == 2
        assert exc_info.value.expected_version == 1

    def test_ec19_api_returns_409_on_conflict(
        self, api_client, workspace, user,
    ):
        from agent_app.services.skill_manager import create_skill

        skill = create_skill(
            workspace=workspace, name='Skill', description='',
            content_md='v1', created_by=user,
        )
        url = f'/api/agent/skills/{skill.pk}/'
        # First PATCH with expected_version=1 → 200.
        resp1 = api_client.patch(url, {
            'patch_md': 'v2',
            'expected_version': 1,
            'patch_summary': 'ok',
        }, format='json')
        assert resp1.status_code == 200, resp1.data

        # Second PATCH still using stale expected_version=1 → 409.
        resp2 = api_client.patch(url, {
            'patch_md': 'v3',
            'expected_version': 1,
            'patch_summary': 'stale',
        }, format='json')
        assert resp2.status_code == 409
        assert resp2.data['error'] == 'version_conflict'
        assert resp2.data['current_version'] == 2


# ═══════════════════════════════════════════════════════════════════════════
#  AC-73 — Sub-Agent return-value filter — orchestrator state hygiene
# ═══════════════════════════════════════════════════════════════════════════


class TestAC73SubAgentReturnFilter:
    def test_orchestrator_state_has_no_intermediate_steps_key(self):
        """After a delegate tool returns, orchestrator state must not contain
        ``intermediate_steps`` — the helper guard surfaces a violation.
        """
        from agent_app.agents.orchestrator import (
            _assert_no_intermediate_steps,
            _extract_final_result,
        )

        # Simulated sub-agent run with a multi-step trace.
        sub_agent_result = {
            'messages': [
                MagicMock(content='step 1 thought', tool_calls=None),
                MagicMock(content='', tool_calls=[{'name': 'tool_a'}]),
                MagicMock(content='final answer', tool_calls=None),
            ],
            # If the orchestrator naively forwarded sub-agent state, this
            # key would leak — the filter strips it.
            'intermediate_steps': [('tool_a', 'observed')],
        }

        # The delegate tool returns ONLY this scalar string.
        final = _extract_final_result(sub_agent_result)
        assert final == 'final answer'

        # Build the orchestrator's MessagesState shape — it carries only
        # delegate return strings, never sub-agent state.
        orchestrator_state = {
            'messages': [
                MagicMock(content='user turn'),
                MagicMock(content=final),
            ],
        }
        # No raise — this is the AC-73 invariant.
        _assert_no_intermediate_steps(orchestrator_state)

    def test_assert_helper_raises_when_state_leaks_steps(self):
        """If something accidentally bubbles intermediate_steps back into
        orchestrator state, the AC-73 guard must surface it.
        """
        from agent_app.agents.orchestrator import _assert_no_intermediate_steps

        with pytest.raises(AssertionError):
            _assert_no_intermediate_steps({
                'messages': [],
                'intermediate_steps': [('a', 'b')],
            })


# ═══════════════════════════════════════════════════════════════════════════
#  EC-18 — char-limit hit during reflection → eviction stays under limit
# ═══════════════════════════════════════════════════════════════════════════


class TestEC18ReflectionEviction:
    def test_eviction_keeps_memory_under_limit(
        self, workspace, user, completed_session,
    ):
        """Pre-fill memory to near limit, run reflection, verify <= limit."""
        from agent_app.services.reflection_service import run_reflection

        # Build memory near the cap by stacking many \n\n-separated blocks.
        block = '- 2026-01-01 prior entry that takes up some space'
        nblocks = (DEFAULT_MEMORY_CHAR_LIMIT // (len(block) + 2)) + 5
        big_md = ('\n\n').join([block] * nblocks)
        # Force-write past the validator via raw save (simulating buggy
        # historical content) — eviction must still bring us back inside.
        WorkspaceMemory.objects.create(
            workspace=workspace,
            content_md=big_md[:DEFAULT_MEMORY_CHAR_LIMIT],  # at limit exactly
        )

        run_reflection(str(completed_session.pk))

        mem = WorkspaceMemory.objects.get(workspace=workspace)
        # After reflection appends a new entry, eviction kept it at-or-below limit.
        assert len(mem.content_md) <= DEFAULT_MEMORY_CHAR_LIMIT


# ═══════════════════════════════════════════════════════════════════════════
#  EC-21 — reflection failure → atomic rollback + retry-once + final log
# ═══════════════════════════════════════════════════════════════════════════


class TestEC21ReflectionRetryOnce:
    def test_first_failure_schedules_retry(
        self, workspace, user, completed_session,
    ):
        """First failure: retry is scheduled on agent queue, no AgentActionLog
        with status=failed yet.
        """
        from agent_app.services import reflection_service

        # Make the eviction step blow up to simulate a downstream LLM/DB error.
        with patch.object(
            reflection_service, '_summarize_session',
            side_effect=RuntimeError('boom'),
        ):
            fake_queue = MagicMock()
            with patch.object(
                reflection_service.django_rq, 'get_queue',
                return_value=fake_queue,
            ):
                reflection_service.run_reflection(str(completed_session.pk))

        # Queue.enqueue_in scheduled — not enqueued as final-failure log.
        assert (
            fake_queue.enqueue_in.called
            or fake_queue.enqueue.called
        ), 'Expected retry to be scheduled on agent queue'
        assert not AgentActionLog.objects.filter(
            session=completed_session,
            action='reflection',
            status=ActionStatus.FAILED,
        ).exists()

    def test_second_failure_logs_to_action_log(
        self, workspace, user, completed_session,
    ):
        """Second failure (retry=True): AgentActionLog row with status=failed."""
        from agent_app.services import reflection_service

        with patch.object(
            reflection_service, '_summarize_session',
            side_effect=RuntimeError('still broken'),
        ):
            reflection_service.run_reflection(
                str(completed_session.pk), retry=True,
            )

        log = AgentActionLog.objects.filter(
            session=completed_session,
            action='reflection',
            status=ActionStatus.FAILED,
        ).first()
        assert log is not None
        assert 'still broken' in log.error_message


# ═══════════════════════════════════════════════════════════════════════════
#  EC-22 — soft-delete excludes from find_relevant_skills, versions remain
# ═══════════════════════════════════════════════════════════════════════════


class TestEC22SoftDeleteVersionsAccessible:
    def test_versions_endpoint_returns_history_for_soft_deleted_skill(
        self, api_client, workspace, user,
    ):
        from agent_app.services.skill_manager import (
            create_skill,
            patch_skill,
            soft_delete_skill,
        )

        skill = create_skill(
            workspace=workspace, name='ToDelete', description='',
            content_md='v1', created_by=user,
        )
        patch_skill(
            skill_id=str(skill.pk), patch_md='v2',
            expected_version=1, patch_summary='evolve',
        )
        soft_delete_skill(skill_id=str(skill.pk))

        # P2 #4 — by default soft-deleted skills are hidden (404). The
        # versions audit chain remains accessible with the explicit
        # ``include_deleted=true`` opt-in (used by the audit / restore UI).
        url = f'/api/agent/skills/{skill.pk}/versions/'
        resp_default = api_client.get(url)
        assert resp_default.status_code == 404

        resp = api_client.get(url + '?include_deleted=true')
        assert resp.status_code == 200
        results = resp.data.get('results', resp.data)
        # Audit chain: v1 (initial), v2 (patch).
        assert len(results) == 2
        assert {r['version'] for r in results} == {1, 2}


# ═══════════════════════════════════════════════════════════════════════════
#  EC-23 — fresh workspace operates without 3 new layers (graceful absence)
# ═══════════════════════════════════════════════════════════════════════════


class TestEC23FreshWorkspaceGracefulAbsence:
    def test_build_agent_context_without_skills_memory_profile(
        self, workspace, user,
    ):
        """A fresh workspace has no Skill / WorkspaceMemory / UserProfile
        rows. ``build_agent_context`` must return a context dict with
        empty / None values instead of raising.
        """
        from agent_app.services.knowledge_loader import build_agent_context

        # Confirm fresh state.
        assert not Skill.objects.filter(workspace=workspace).exists()
        assert not WorkspaceMemory.objects.filter(workspace=workspace).exists()
        assert not UserProfile.objects.filter(workspace=workspace).exists()

        # Vector search disabled in tests — fall back to empty results.
        with patch(
            'vector_app.services.EmbeddingService',
        ) as cls:
            cls.return_value.search.return_value = []
            ctx = build_agent_context(
                workspace=workspace,
                agent_type='research',
                query_text='whatever',
                user=user,
            )
        # All 6 layers present in the dict but Layers 4-6 are empty/[].
        assert 'system_prompt' in ctx
        assert 'knowledge_docs' in ctx
        assert 'implicit_knowledge' in ctx
        assert ctx['workspace_memory'] == ''
        assert ctx['user_profile'] == ''
        assert ctx['skills'] == []

    def test_render_prompt_handles_empty_layers(self, workspace, user):
        """``render_context_as_prompt`` must not crash when L4/L5/L6 empty."""
        from agent_app.services.knowledge_loader import (
            build_agent_context,
            render_context_as_prompt,
        )

        with patch(
            'vector_app.services.EmbeddingService',
        ) as cls:
            cls.return_value.search.return_value = []
            ctx = build_agent_context(
                workspace=workspace, agent_type='research',
                query_text='', user=user,
            )
        rendered = render_context_as_prompt(ctx)
        assert isinstance(rendered, str)


# ═══════════════════════════════════════════════════════════════════════════
#  QA Coverage Gaps — admin-raised char-limit + soft-delete + reflect dedup
# ═══════════════════════════════════════════════════════════════════════════


class TestQAAdminRaisedCharLimits:
    """P0 #2 — admin-raised limits in AgentWorkspaceConfig must NOT be
    rejected by stale model-level validators on ``content_md``. Previously
    the column hard-capped at the default and any admin-raised limit was
    silently invalidated by ``model.full_clean()``.
    """

    def test_admin_raised_memory_limit_lets_user_save_2800_chars(
        self, api_client, workspace,
    ):
        cfg = AgentWorkspaceConfig.objects.create(
            workspace=workspace,
            memory_char_limit=3000,
        )
        big = 'm' * 2800  # > default 2200, < admin-raised 3000
        resp = api_client.patch('/api/agent/memory/', {
            'content_md': big,
        }, format='json')
        assert resp.status_code == 200, resp.data
        mem = WorkspaceMemory.objects.get(workspace=workspace)
        assert len(mem.content_md) == 2800
        # Sanity — config is what gated it.
        cfg.refresh_from_db()
        assert cfg.memory_char_limit == 3000

    def test_admin_raised_profile_limit_lets_user_save_2000_chars(
        self, api_client, workspace, user,
    ):
        AgentWorkspaceConfig.objects.create(
            workspace=workspace,
            profile_char_limit=2200,
        )
        big = 'p' * 2000  # > default 1375, < admin-raised 2200
        resp = api_client.patch('/api/agent/profile/', {
            'content_md': big,
        }, format='json')
        assert resp.status_code == 200, resp.data
        profile = UserProfile.objects.get(workspace=workspace, user=user)
        assert len(profile.content_md) == 2000


class TestQASoftDeletedSkillLeak:
    """P2 #4 — GET / PATCH on a soft-deleted skill returns 404 by default.
    With ``?include_deleted=true`` it returns 200 with ``is_active=False``.
    """

    def test_soft_deleted_skill_get_returns_404_by_default(
        self, api_client, workspace, user,
    ):
        from agent_app.services.skill_manager import (
            create_skill,
            soft_delete_skill,
        )

        skill = create_skill(
            workspace=workspace, name='Soon-to-be-deleted',
            description='', content_md='body', created_by=user,
        )
        soft_delete_skill(skill_id=str(skill.pk))

        url = f'/api/agent/skills/{skill.pk}/'
        resp = api_client.get(url)
        assert resp.status_code == 404

        # Opt-in flag surfaces the deleted row.
        resp_inc = api_client.get(url + '?include_deleted=true')
        assert resp_inc.status_code == 200
        assert resp_inc.data['is_active'] is False
        assert resp_inc.data['deleted_at'] is not None

    def test_soft_deleted_skill_patch_returns_404(
        self, api_client, workspace, user,
    ):
        from agent_app.services.skill_manager import (
            create_skill,
            soft_delete_skill,
        )

        skill = create_skill(
            workspace=workspace, name='Patch-after-delete',
            description='', content_md='v1', created_by=user,
        )
        soft_delete_skill(skill_id=str(skill.pk))

        resp = api_client.patch(
            f'/api/agent/skills/{skill.pk}/',
            {'patch_md': 'v2', 'expected_version': 1, 'patch_summary': 'x'},
            format='json',
        )
        assert resp.status_code == 404


class TestQAReflectionDedup:
    """P2 #5 — re-trigger reflection on a session whose result is already
    consolidated into WorkspaceMemory returns 409 ``already_reflected``.
    """

    def test_already_reflected_session_returns_409(
        self, api_client, workspace, user, completed_session,
    ):
        # Simulate a prior successful reflection: WorkspaceMemory has
        # ``last_consolidated_session`` pointing at this session.
        WorkspaceMemory.objects.create(
            workspace=workspace,
            content_md='already consolidated',
            last_consolidated_at=timezone.now(),
            last_consolidated_session=completed_session,
        )
        url = f'/api/agent/sessions/{completed_session.pk}/reflect/'
        resp = api_client.post(url, {}, format='json')
        assert resp.status_code == 409
        assert resp.data['error'] == 'already_reflected'


class TestQASkillCreateAgentTypeValidation:
    """P1 #2 — POST /api/agent/skills/ with an invalid agent_type returns 400."""

    def test_post_invalid_agent_type_returns_400(
        self, api_client, workspace, user,
    ):
        from workspace_app.models import Membership

        # Promote user to admin (manual skill create requires admin).
        Membership.objects.filter(user=user, workspace=workspace).update(
            role='admin',
        )
        resp = api_client.post('/api/agent/skills/', {
            'name': 'Skill X',
            'description': '',
            'content_md': 'body',
            'applicable_agent_types': ['not_a_real_agent_type'],
        }, format='json')
        assert resp.status_code == 400
        assert 'applicable_agent_types' in resp.data


class TestQASkillsListAgentTypeValidation:
    """P1 #1 — GET /api/agent/skills/?agent_type=<bad> returns 400."""

    def test_get_invalid_agent_type_returns_400(
        self, api_client, workspace,
    ):
        resp = api_client.get('/api/agent/skills/?agent_type=lol_invalid')
        assert resp.status_code == 400
        assert resp.data['error'] == 'invalid_agent_type'

    def test_get_valid_agent_type_returns_200(
        self, api_client, workspace,
    ):
        resp = api_client.get('/api/agent/skills/?agent_type=research')
        assert resp.status_code == 200

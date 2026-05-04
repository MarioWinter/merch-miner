"""Phase 8 — Serializers polish: computed fields + nested payloads."""
from __future__ import annotations

import uuid

import pytest

from agent_app.api.serializers import (
    AgentActionLogSerializer,
    AgentConfigSerializer,
    AgentMessageSerializer,
    AgentSessionDetailSerializer,
    AutonomyPresetSerializer,
    KnowledgeDocSerializer,
    ToolPermissionSerializer,
    WorkflowTemplateSerializer,
)
from agent_app.models import (
    ActionStatus,
    AGENT_DEFAULTS,
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AgentType,
    AutonomyPreset,
    KnowledgeDoc,
    MessageRole,
    ToolPermission,
    WorkflowTemplate,
)

pytestmark = pytest.mark.django_db


# ── Fixtures ──

@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='ser@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership

    return Membership.objects.get(user=user, status='active').workspace


@pytest.fixture
def session(workspace, user):
    return AgentSession.objects.create(
        workspace=workspace,
        created_by=user,
        title='Test session',
        total_steps=4,
        completed_steps=1,
        current_step='research.deep_research',
    )


# ══════════════════════════════════════════
#  AgentConfigSerializer.personality_presets
# ══════════════════════════════════════════

class TestAgentConfigSerializer:
    def test_personality_presets_for_orchestrator(self, workspace):
        config = AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.ORCHESTRATOR,
            display_name='Chief',
        )
        data = AgentConfigSerializer(config).data
        presets = data['personality_presets']
        assert isinstance(presets, list)
        assert len(presets) == 3  # Projektleiter, Creative Director, Minimalist
        names = {p['name'] for p in presets}
        assert names == {'Projektleiter', 'Creative Director', 'Minimalist'}
        # Each preset has key + name + description
        for p in presets:
            assert set(p.keys()) == {'key', 'name', 'description'}
            assert p['key']  # non-empty slug
            assert p['description']

    def test_personality_presets_filtered_by_agent_type(self, workspace):
        config = AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.RESEARCH,
            display_name='Scout',
        )
        presets = AgentConfigSerializer(config).data['personality_presets']
        names = {p['name'] for p in presets}
        # Research has 2 presets per spec.
        assert names == {'Analyst', 'Scout'}

    def test_personality_presets_keys_are_slugs(self, workspace):
        config = AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.ORCHESTRATOR,
            display_name='Chief',
        )
        presets = AgentConfigSerializer(config).data['personality_presets']
        keys = {p['key'] for p in presets}
        assert 'projektleiter' in keys
        assert 'creative_director' in keys
        assert 'minimalist' in keys


# ══════════════════════════════════════════
#  AgentSessionDetailSerializer
# ══════════════════════════════════════════

class TestAgentSessionDetailSerializer:
    def test_progress_computed(self, session):
        data = AgentSessionDetailSerializer(session).data
        progress = data['progress']
        assert progress['total_steps'] == 4
        assert progress['completed_steps'] == 1
        assert progress['percent'] == 25
        assert progress['current_step'] == 'research.deep_research'

    def test_progress_zero_total_no_division_error(self, workspace, user):
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, total_steps=0, completed_steps=0,
        )
        data = AgentSessionDetailSerializer(s).data
        assert data['progress']['percent'] == 0

    def test_niche_context_nested_when_present(self, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Wonder Valley', created_by=user,
        )
        s = AgentSession.objects.create(
            workspace=workspace, created_by=user, niche_context=niche,
        )
        data = AgentSessionDetailSerializer(s).data
        assert data['niche_context'] == {
            'id': str(niche.id),
            'name': 'Wonder Valley',
        }

    def test_niche_context_null_when_absent(self, session):
        data = AgentSessionDetailSerializer(session).data
        assert data['niche_context'] is None

    def test_message_count_computed(self, session):
        AgentMessage.objects.create(
            session=session, role=MessageRole.USER, content='hi',
        )
        AgentMessage.objects.create(
            session=session, role=MessageRole.AGENT, content='hello',
        )
        data = AgentSessionDetailSerializer(session).data
        assert data['message_count'] == 2


# ══════════════════════════════════════════
#  AgentMessageSerializer
# ══════════════════════════════════════════

class TestAgentMessageSerializer:
    def test_display_name_and_emoji_from_config(self, session, workspace):
        AgentConfig.objects.create(
            workspace=workspace,
            agent_type=AgentType.RESEARCH,
            display_name='Custom Scout',
            avatar_emoji='\U0001f9ea',  # test tube
        )
        msg = AgentMessage.objects.create(
            session=session,
            role=MessageRole.AGENT,
            agent_type=AgentType.RESEARCH,
            content='Researching...',
        )
        configs = {
            c.agent_type: c
            for c in AgentConfig.objects.filter(workspace=workspace)
        }
        data = AgentMessageSerializer(
            msg, context={'agent_configs': configs},
        ).data
        assert data['agent_display_name'] == 'Custom Scout'
        assert data['agent_avatar_emoji'] == '\U0001f9ea'

    def test_falls_back_to_defaults_without_config(self, session):
        """When no AgentConfig record exists, use AGENT_DEFAULTS."""
        msg = AgentMessage.objects.create(
            session=session,
            role=MessageRole.AGENT,
            agent_type=AgentType.DESIGN,
            content='Generating...',
        )
        data = AgentMessageSerializer(msg, context={'agent_configs': {}}).data
        defaults = AGENT_DEFAULTS[AgentType.DESIGN]
        assert data['agent_display_name'] == defaults['display_name']
        assert data['agent_avatar_emoji'] == defaults['avatar_emoji']

    def test_user_message_has_no_agent_fields(self, session):
        msg = AgentMessage.objects.create(
            session=session, role=MessageRole.USER, content='hi',
        )
        data = AgentMessageSerializer(msg).data
        assert data['agent_display_name'] is None
        assert data['agent_avatar_emoji'] is None


# ══════════════════════════════════════════
#  AgentActionLogSerializer.target_summary
# ══════════════════════════════════════════

class TestAgentActionLogSerializer:
    def test_target_summary_resolves_niche(self, session, workspace, user):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Coffee Lovers', created_by=user,
        )
        log = AgentActionLog.objects.create(
            session=session,
            workspace=workspace,
            user=user,
            agent_type='research',
            action='read_niche_details',
            target_object_type='Niche',
            target_object_id=niche.id,
            status=ActionStatus.COMPLETED,
        )
        data = AgentActionLogSerializer(log).data
        assert data['target_summary'] == 'Niche: Coffee Lovers'

    def test_target_summary_deleted_object(self, session, workspace, user):
        log = AgentActionLog.objects.create(
            session=session,
            workspace=workspace,
            user=user,
            agent_type='research',
            action='read_niche_details',
            target_object_type='Niche',
            target_object_id=uuid.uuid4(),  # nonexistent
            status=ActionStatus.COMPLETED,
        )
        data = AgentActionLogSerializer(log).data
        assert data['target_summary'] == 'Niche: (deleted)'

    def test_target_summary_unknown_type(self, session, workspace, user):
        log = AgentActionLog.objects.create(
            session=session,
            workspace=workspace,
            user=user,
            agent_type='research',
            action='custom',
            target_object_type='UnknownType',
            target_object_id=uuid.uuid4(),
            status=ActionStatus.COMPLETED,
        )
        data = AgentActionLogSerializer(log).data
        # Falls back to "<Type>: <id>"
        assert data['target_summary'].startswith('UnknownType:')

    def test_target_summary_null_when_no_target(self, session, workspace, user):
        log = AgentActionLog.objects.create(
            session=session,
            workspace=workspace,
            user=user,
            agent_type='search',
            action='web_search',
            status=ActionStatus.COMPLETED,
        )
        data = AgentActionLogSerializer(log).data
        assert data['target_summary'] is None


# ══════════════════════════════════════════
#  ToolPermissionSerializer.tool_description
# ══════════════════════════════════════════

class TestToolPermissionSerializer:
    def test_tool_description_present(self, workspace, user):
        perm = ToolPermission.objects.create(
            workspace=workspace,
            user=user,
            tool_name='trigger_deep_research',
            permission_level='approve',
        )
        data = ToolPermissionSerializer(perm).data
        assert data['tool_description'] == (
            'Trigger deep niche research (costs API credits)'
        )

    def test_tool_description_unknown_tool_returns_empty(self, workspace, user):
        perm = ToolPermission.objects.create(
            workspace=workspace,
            user=user,
            tool_name='nonexistent_tool',
            permission_level='auto',
        )
        data = ToolPermissionSerializer(perm).data
        assert data['tool_description'] == ''


# ══════════════════════════════════════════
#  AutonomyPresetSerializer
# ══════════════════════════════════════════

class TestAutonomyPresetSerializer:
    def test_tool_count_matches_permissions(self, workspace):
        preset = AutonomyPreset.objects.create(
            workspace=workspace,
            name='Custom',
            is_system=False,
            permissions={'tool_a': 'auto', 'tool_b': 'notify', 'tool_c': 'approve'},
        )
        data = AutonomyPresetSerializer(preset).data
        assert data['tool_count'] == 3
        assert data['permissions'] == preset.permissions

    def test_tool_count_zero_for_empty(self, workspace):
        preset = AutonomyPreset.objects.create(
            workspace=workspace, name='Empty', permissions={},
        )
        data = AutonomyPresetSerializer(preset).data
        assert data['tool_count'] == 0


# ══════════════════════════════════════════
#  KnowledgeDocSerializer
# ══════════════════════════════════════════

class TestKnowledgeDocSerializer:
    def test_content_preview_short_content(self, workspace, user):
        doc = KnowledgeDoc.objects.create(
            workspace=workspace,
            created_by=user,
            title='Tip',
            content='Short content',
        )
        data = KnowledgeDocSerializer(doc).data
        assert data['content_preview'] == 'Short content'
        assert data['created_by_username'] in (user.username, user.email)

    def test_content_preview_truncates_long(self, workspace, user):
        long_text = 'x' * 500
        doc = KnowledgeDoc.objects.create(
            workspace=workspace, created_by=user, title='Long', content=long_text,
        )
        data = KnowledgeDocSerializer(doc).data
        assert len(data['content_preview']) <= 201  # 200 + ellipsis
        assert data['content_preview'].endswith('…')


# ══════════════════════════════════════════
#  WorkflowTemplateSerializer.steps_with_descriptions
# ══════════════════════════════════════════

class TestWorkflowTemplateSerializer:
    def test_system_template_steps_have_descriptions(self, workspace):
        tmpl = WorkflowTemplate.objects.create(
            workspace=workspace,
            name='Full Pipeline',
            key='full_pipeline',
            is_system=True,
            steps=[
                {
                    'agent_type': 'research',
                    'action': 'deep_research',
                    'description': 'Run deep niche research',
                },
                {
                    'agent_type': 'ideation',
                    'action': 'slogan_generation',
                    'description': 'Generate slogans and ideas',
                },
            ],
        )
        data = WorkflowTemplateSerializer(tmpl).data
        steps = data['steps_with_descriptions']
        assert len(steps) == 2
        assert steps[0] == {
            'agent_type': 'research',
            'action': 'deep_research',
            'description': 'Run deep niche research',
        }
        assert steps[1]['description'] == 'Generate slogans and ideas'

    def test_custom_template_falls_back_to_action_description(self, workspace):
        """Custom templates may omit description — serializer fills it in."""
        tmpl = WorkflowTemplate.objects.create(
            workspace=workspace,
            name='Custom',
            key='custom_x',
            is_system=False,
            steps=[
                {'agent_type': 'design', 'action': 'design_generation'},
            ],
        )
        data = WorkflowTemplateSerializer(tmpl).data
        steps = data['steps_with_descriptions']
        assert steps[0]['description'] == 'Generate designs'

    def test_unknown_action_falls_back_to_titled_label(self, workspace):
        tmpl = WorkflowTemplate.objects.create(
            workspace=workspace,
            name='Custom2',
            key='custom_y',
            is_system=False,
            steps=[{'agent_type': 'research', 'action': 'mystery_step'}],
        )
        data = WorkflowTemplateSerializer(tmpl).data
        assert data['steps_with_descriptions'][0]['description'] == 'Mystery Step'

"""PROJ-29 Phase 1B Round 2 — Idea enum hardening + serializer validators."""

import importlib

import pytest
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError

from idea_app.api.serializers import IdeaSerializer

User = get_user_model()


_MIGRATION = importlib.import_module(
    'idea_app.migrations.0006_idea_pattern_stylistic_choices',
)


@pytest.fixture
def user(db):
    return User.objects.create_user(email='enum@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Enum WS', slug='enum-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(workspace=workspace, name='Test', created_by=user)


def _make_idea(workspace, niche, user):
    from idea_app.models import Idea
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='S', is_manual=True, created_by=user,
    )


@pytest.mark.django_db
class TestIdeaSerializerPatternValidator:
    def test_accepts_valid_enum_key(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea,
            data={'pattern_used': 'IDENTITY_DECLARATION'},
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_accepts_blank(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'pattern_used': ''}, partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_rejects_unknown_value(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'pattern_used': 'TOTALLY_FAKE_PATTERN'}, partial=True,
        )
        assert not serializer.is_valid()
        assert 'pattern_used' in serializer.errors

    def test_rejects_legacy_slash_form_input(self, workspace, niche, user):
        """Legacy display form is no longer accepted as raw input.

        Existing legacy rows are normalised by the data migration; new writes
        must use enum keys (the LLM is prompted to emit them).
        """
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'pattern_used': 'IDENTITY DECLARATION'}, partial=True,
        )
        assert not serializer.is_valid()
        assert 'pattern_used' in serializer.errors


@pytest.mark.django_db
class TestIdeaSerializerStylisticValidator:
    def test_accepts_valid_enum_key(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'stylistic_device': 'RHYME'}, partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_accepts_blank(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'stylistic_device': ''}, partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_rejects_unknown_value(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'stylistic_device': 'HAIKU'}, partial=True,
        )
        assert not serializer.is_valid()
        assert 'stylistic_device' in serializer.errors


@pytest.mark.django_db
class TestIdeaSerializerArchetypeValidator:
    def test_accepts_blank_string(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'emotional_archetype': ''}, partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_accepts_single_valid_archetype_string(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'emotional_archetype': 'Hero'}, partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_accepts_comma_separated_valid_archetypes(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'emotional_archetype': 'Hero,Rebel,Jester'}, partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_rejects_unknown_archetype(self, workspace, niche, user):
        idea = _make_idea(workspace, niche, user)
        serializer = IdeaSerializer(
            idea, data={'emotional_archetype': 'Hero,Wizard'}, partial=True,
        )
        assert not serializer.is_valid()
        assert 'emotional_archetype' in serializer.errors

    def test_rejects_unknown_archetype_via_validator_direct(self):
        """Direct validator call should raise ValidationError on unknown tokens."""
        s = IdeaSerializer()
        with pytest.raises(ValidationError):
            s.validate_emotional_archetype(['Hero', 'Druid'])


class TestPatternNormalisationHelpers:
    """Unit-test the data-migration helpers without requiring DB state."""

    def test_normalise_pattern_value_slash_form(self):
        assert _MIGRATION._normalise_pattern_value(
            'IDENTITY DECLARATION'
        ) == 'IDENTITY_DECLARATION'
        assert _MIGRATION._normalise_pattern_value(
            'TRIBE/COMMUNITY'
        ) == 'TRIBE_COMMUNITY'
        assert _MIGRATION._normalise_pattern_value(
            'CROSS-NICHE EVENTS'
        ) == 'CROSS_NICHE_EVENTS'

    def test_normalise_pattern_value_already_enum(self):
        assert _MIGRATION._normalise_pattern_value(
            'GROUP_LEADER'
        ) == 'GROUP_LEADER'

    def test_normalise_pattern_value_unknown_cleared(self):
        assert _MIGRATION._normalise_pattern_value('TOTALLY_INVENTED') == ''
        assert _MIGRATION._normalise_pattern_value('') == ''

    def test_normalise_stylistic_value(self):
        assert _MIGRATION._normalise_stylistic_value('Rhyme') == 'RHYME'
        assert _MIGRATION._normalise_stylistic_value(
            'Question + Answer'
        ) == 'QUESTION_ANSWER'
        assert _MIGRATION._normalise_stylistic_value(
            'Songtext Adaption'
        ) == 'SONGTEXT_ADAPTION'
        assert _MIGRATION._normalise_stylistic_value('Free-form') == 'FREE_FORM'
        assert _MIGRATION._normalise_stylistic_value('Sonnet') == ''
        assert _MIGRATION._normalise_stylistic_value('') == ''

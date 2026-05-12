"""PROJ-29 Phase 1B Round 3: contextual_header.generate_header."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from niche_app.models import Niche, NicheNote
from vector_app.services.contextual_header import generate_header
from workspace_app.models import Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='proj29-ch@example.com', password='pw')


@pytest.fixture
def workspace(db, user):
    return Workspace.objects.create(name='WS-CH', slug='ws-ch', owner=user)


@pytest.fixture
def niche(db, user, workspace):
    return Niche.objects.create(name='Bus Driver', workspace=workspace, created_by=user)


@pytest.fixture
def idea(db, niche, user, workspace):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='I Survived the 6AM Shift', created_by=user,
    )


@pytest.fixture
def note(db, niche, user):
    return NicheNote.objects.create(niche=niche, text='Background context', created_by=user)


@pytest.mark.django_db
def test_returns_empty_for_unsupported_subtype(idea):
    """Subtypes other than slogan/notes must return ''."""
    assert generate_header(idea, 'product', 'some text') == ''
    assert generate_header(idea, 'keyword', 'some text') == ''
    assert generate_header(idea, 'analysis', 'some text') == ''
    assert generate_header(idea, 'unknown', 'some text') == ''


@pytest.mark.django_db
def test_returns_empty_for_blank_text(idea):
    assert generate_header(idea, 'slogan', '') == ''
    assert generate_header(idea, 'slogan', '   ') == ''


@pytest.mark.django_db
def test_returns_empty_when_niche_missing(db, user, workspace):
    """An Idea without a niche FK -> '' (header needs niche name)."""
    orphan = Idea.objects.create(
        workspace=workspace, niche=None,
        slogan_text='orphan slogan', created_by=user,
    )
    assert generate_header(orphan, 'slogan', orphan.slogan_text) == ''


@pytest.mark.django_db
def test_generates_header_for_slogan(idea):
    """When LLM returns content, the header (stripped) is returned for 'slogan'."""
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(
        content='  A slogan in the Bus Driver niche for Merch by Amazon t-shirts.  '
    )
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM_PROMPT'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RESOLVED SYSTEM PROMPT',
    ):
        header = generate_header(idea, 'slogan', idea.slogan_text)
    assert 'Bus Driver' in header
    assert not header.startswith(' ')
    assert not header.endswith(' ')


@pytest.mark.django_db
def test_generates_header_for_notes(note):
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content='A note in the Bus Driver niche.')
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM_PROMPT'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RESOLVED',
    ):
        header = generate_header(note, 'notes', note.text)
    assert 'Bus Driver' in header


@pytest.mark.django_db
def test_llm_failure_returns_empty(idea):
    """LLM errors must NOT crash the pipeline; return ''."""
    fake_llm = MagicMock()
    fake_llm.invoke.side_effect = RuntimeError('LLM provider exploded')
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM_PROMPT'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RESOLVED',
    ):
        header = generate_header(idea, 'slogan', idea.slogan_text)
    assert header == ''


@pytest.mark.django_db
def test_empty_llm_response_returns_empty(idea):
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = MagicMock(content='')
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM_PROMPT'),
    ), patch(
        'chat_node_config_app.services.resolver.get_chat_prompt',
        return_value='RESOLVED',
    ):
        header = generate_header(idea, 'slogan', idea.slogan_text)
    assert header == ''

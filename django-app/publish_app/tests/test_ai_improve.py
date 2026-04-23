"""Unit tests for ``publish_app.services.ai_improve``.

Covers the 4 pure functions (``build_prompt``, ``call_llm``,
``validate_and_truncate``, ``apply_to_listing``). ``call_llm`` is always
mocked -- no real OpenRouter calls from tests.

Phase M1 scope (PROJ-11 AC-69..AC-72). View/throttle tests land in Phase M2+.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import DesignAsset, Listing
from publish_app.services import ai_improve
from publish_app.services.ai_improve import (
    EXPECTED_FIELDS,
    AIImproveError,
    apply_to_listing,
    build_prompt,
    call_llm,
    validate_and_truncate,
)
from publish_app.services.translator import CHAR_LIMITS
from workspace_app.models import Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='ai-improve@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='AI Improve WS', slug='ai-improve-ws', owner=user,
    )


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Cat Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='I Love My Cat', created_by=user,
    )


@pytest.fixture
def design(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace,
        file_name='cat-design.png',
        file_url='https://cdn.example.com/designs/cat.png',
        thumbnail_url='https://cdn.example.com/thumbs/cat.png',
        created_by=user,
    )


@pytest.fixture
def listing(workspace, idea, design):
    return Listing.objects.create(
        workspace=workspace,
        idea=idea,
        design=design,
        brand_name='CatCo',
        title='Cat Lovers Unite',
        bullet_1='Premium cotton tee',
        bullet_2='Soft fit, vivid print',
        description='For true cat enthusiasts.',
        keyword_context='cat lover, cat mom, tshirt',
        language='en',
    )


# ---------------------------------------------------------------------------
# build_prompt
# ---------------------------------------------------------------------------

class TestBuildPrompt:
    def test_returns_system_plus_user_messages(self, listing, design):
        messages = build_prompt(
            listing=listing,
            design=design,
            keyword_context='retro cat, vintage cat shirt',
            language='en',
        )
        assert isinstance(messages, list)
        assert len(messages) == 2
        assert messages[0]['role'] == 'system'
        assert messages[1]['role'] == 'user'

    def test_user_message_includes_design_image_url(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='en',
        )
        content = messages[1]['content']
        assert isinstance(content, list)
        image_parts = [c for c in content if c.get('type') == 'image_url']
        assert len(image_parts) == 1
        assert image_parts[0]['image_url']['url'] == (
            'https://cdn.example.com/designs/cat.png'
        )

    def test_user_message_includes_keyword_context_hint(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='retro cat, vintage cat shirt',
            language='en',
        )
        text_parts = [
            c['text'] for c in messages[1]['content'] if c.get('type') == 'text'
        ]
        joined = '\n'.join(text_parts)
        assert 'retro cat, vintage cat shirt' in joined

    def test_user_message_includes_existing_listing_copy(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='en',
        )
        text = messages[1]['content'][0]['text']
        assert 'Cat Lovers Unite' in text
        assert 'Premium cotton tee' in text
        assert 'For true cat enthusiasts.' in text

    def test_localizes_language_label(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='de',
        )
        text = messages[1]['content'][0]['text']
        assert 'German' in text
        assert '(de)' in text

    def test_unknown_language_falls_back_to_code(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='zz',
        )
        text = messages[1]['content'][0]['text']
        # No crash, and the raw code is still passed so LLM can do something.
        assert '(zz)' in text

    def test_char_limits_documented_in_prompt(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='en',
        )
        text = messages[1]['content'][0]['text']
        for field in EXPECTED_FIELDS:
            limit = CHAR_LIMITS[field]
            assert f'{field}: {limit} chars' in text

    def test_empty_keyword_context_shown_as_none(self, listing, design):
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='en',
        )
        text = messages[1]['content'][0]['text']
        assert '(none)' in text

    def test_falls_back_to_thumbnail_when_file_url_empty(
        self, workspace, idea, user,
    ):
        design = DesignAsset.objects.create(
            workspace=workspace,
            file_name='t.png',
            file_url='',
            thumbnail_url='https://cdn.example.com/thumb-only.png',
            created_by=user,
        )
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
        )
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='en',
        )
        image_parts = [
            c for c in messages[1]['content'] if c.get('type') == 'image_url'
        ]
        assert len(image_parts) == 1
        assert image_parts[0]['image_url']['url'] == (
            'https://cdn.example.com/thumb-only.png'
        )

    def test_no_image_url_sends_text_only(self, workspace, idea, user):
        design = DesignAsset.objects.create(
            workspace=workspace, file_name='t.png', created_by=user,
        )
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
        )
        messages = build_prompt(
            listing=listing, design=design,
            keyword_context='', language='en',
        )
        content = messages[1]['content']
        # No image parts at all -- text-only fallback
        image_parts = [c for c in content if c.get('type') == 'image_url']
        assert image_parts == []
        assert content[0]['type'] == 'text'


# ---------------------------------------------------------------------------
# validate_and_truncate
# ---------------------------------------------------------------------------

class TestValidateAndTruncate:
    def test_returns_all_5_fields_within_limits(self):
        raw = {
            'title': 'Short Title',
            'bullet_1': 'Short bullet',
            'bullet_2': 'Another bullet',
            'description': 'A short description.',
            'keyword_context': 'cat, retro',
        }
        fields, truncated = validate_and_truncate(raw)
        assert set(fields.keys()) == set(EXPECTED_FIELDS)
        assert truncated == []
        assert fields['title'] == 'Short Title'

    def test_truncates_title_over_60_chars(self):
        raw = {
            'title': 'x' * 80,
            'bullet_1': '', 'bullet_2': '',
            'description': '', 'keyword_context': '',
        }
        fields, truncated = validate_and_truncate(raw)
        assert len(fields['title']) == 60
        assert 'title' in truncated

    def test_truncates_bullets_over_256_chars(self):
        raw = {
            'title': 'ok',
            'bullet_1': 'a' * 300,
            'bullet_2': 'b' * 300,
            'description': '', 'keyword_context': '',
        }
        fields, truncated = validate_and_truncate(raw)
        assert len(fields['bullet_1']) == 256
        assert len(fields['bullet_2']) == 256
        assert 'bullet_1' in truncated
        assert 'bullet_2' in truncated

    def test_truncates_description_over_2000_chars(self):
        raw = {
            'title': 'ok', 'bullet_1': '', 'bullet_2': '',
            'description': 'x' * 2500,
            'keyword_context': '',
        }
        fields, truncated = validate_and_truncate(raw)
        assert len(fields['description']) == 2000
        assert 'description' in truncated

    def test_truncates_keyword_context_over_500_chars(self):
        raw = {
            'title': 'ok', 'bullet_1': '', 'bullet_2': '', 'description': '',
            'keyword_context': 'k' * 800,
        }
        fields, truncated = validate_and_truncate(raw)
        assert len(fields['keyword_context']) == 500
        assert 'keyword_context' in truncated

    def test_missing_fields_default_to_empty_string(self):
        raw = {'title': 'Only Title'}
        fields, truncated = validate_and_truncate(raw)
        assert fields['bullet_1'] == ''
        assert fields['bullet_2'] == ''
        assert fields['description'] == ''
        assert fields['keyword_context'] == ''
        assert truncated == []

    def test_none_values_coerced_to_empty_string(self):
        raw = {
            'title': None, 'bullet_1': None, 'bullet_2': None,
            'description': None, 'keyword_context': None,
        }
        fields, truncated = validate_and_truncate(raw)
        for key in EXPECTED_FIELDS:
            assert fields[key] == ''
        assert truncated == []

    def test_non_string_values_coerced_via_str(self):
        raw = {
            'title': 123, 'bullet_1': 45.6, 'bullet_2': True,
            'description': ['list', 'stuff'], 'keyword_context': '',
        }
        fields, _ = validate_and_truncate(raw)
        assert fields['title'] == '123'
        assert fields['bullet_1'] == '45.6'
        assert fields['bullet_2'] == 'True'
        assert "list" in fields['description']

    def test_non_dict_response_raises(self):
        with pytest.raises(AIImproveError):
            validate_and_truncate('not a dict')  # type: ignore[arg-type]

    def test_all_limits_hit_returns_all_keys(self):
        raw = {
            'title': 'x' * 100,
            'bullet_1': 'y' * 300,
            'bullet_2': 'z' * 300,
            'description': 'd' * 3000,
            'keyword_context': 'k' * 700,
        }
        _, truncated = validate_and_truncate(raw)
        assert set(truncated) == set(EXPECTED_FIELDS)


# ---------------------------------------------------------------------------
# call_llm (mocked)
# ---------------------------------------------------------------------------

class TestCallLlm:
    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_returns_parsed_json_on_happy_path(self, mock_llm_cls):
        mock_response = MagicMock()
        mock_response.content = json.dumps({
            'title': 'Ok',
            'bullet_1': 'Ok b1',
            'bullet_2': 'Ok b2',
            'description': 'Ok desc',
            'keyword_context': 'k1, k2',
        })
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        result = call_llm([{'role': 'system', 'content': 'x'}])
        assert result['title'] == 'Ok'
        assert result['keyword_context'] == 'k1, k2'

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_non_json_response_raises_ai_improve_error(self, mock_llm_cls):
        mock_response = MagicMock()
        mock_response.content = 'Sorry, I cannot produce JSON today.'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        with pytest.raises(AIImproveError, match='non-JSON'):
            call_llm([])

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_json_wrapped_in_text_still_parses(self, mock_llm_cls):
        mock_response = MagicMock()
        mock_response.content = (
            'Here is the JSON you asked for:\n'
            '{"title": "T", "bullet_1": "", "bullet_2": "",'
            ' "description": "", "keyword_context": ""}\n'
            'Let me know if you need changes.'
        )
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        result = call_llm([])
        assert result['title'] == 'T'

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_upstream_exception_wrapped_in_ai_improve_error(self, mock_llm_cls):
        mock_llm = MagicMock()
        mock_llm.invoke.side_effect = RuntimeError('Openrouter 502')
        mock_llm_cls.return_value = mock_llm

        with pytest.raises(AIImproveError, match='LLM upstream call failed'):
            call_llm([])

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_reads_model_and_timeout_from_env(self, mock_llm_cls, monkeypatch):
        monkeypatch.setenv('AI_IMPROVE_MODEL', 'openai/gpt-4.1-mini')
        monkeypatch.setenv('AI_IMPROVE_TIMEOUT_SECONDS', '30')

        mock_response = MagicMock()
        mock_response.content = '{"title": "", "bullet_1": "", "bullet_2": "", "description": "", "keyword_context": ""}'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        call_llm([])
        kwargs = mock_llm_cls.call_args.kwargs
        assert kwargs['model'] == 'openai/gpt-4.1-mini'
        assert kwargs['timeout'] == 30


# ---------------------------------------------------------------------------
# apply_to_listing
# ---------------------------------------------------------------------------

class TestApplyToListing:
    def test_writes_all_5_fields(self, listing):
        listing.status = Listing.Status.READY
        listing.generated_by = Listing.GeneratedBy.MANUAL
        listing.save()

        fields = {
            'title': 'New Title',
            'bullet_1': 'New bullet 1',
            'bullet_2': 'New bullet 2',
            'description': 'New description.',
            'keyword_context': 'new, kw',
        }
        updated = apply_to_listing(listing, fields)

        assert updated.title == 'New Title'
        assert updated.bullet_1 == 'New bullet 1'
        assert updated.bullet_2 == 'New bullet 2'
        assert updated.description == 'New description.'
        assert updated.keyword_context == 'new, kw'

    def test_sets_generated_by_ai(self, listing):
        listing.generated_by = Listing.GeneratedBy.MANUAL
        listing.save()

        fields = {key: 'v' for key in EXPECTED_FIELDS}
        updated = apply_to_listing(listing, fields)
        assert updated.generated_by == Listing.GeneratedBy.AI

    def test_reverts_status_to_draft(self, listing):
        listing.status = Listing.Status.READY
        listing.save()

        fields = {key: 'v' for key in EXPECTED_FIELDS}
        updated = apply_to_listing(listing, fields)
        assert updated.status == Listing.Status.DRAFT

    def test_serializer_validation_failure_raises(self, listing):
        # Simulate a field that exceeds max_length despite truncation being
        # the caller's job. The serializer layer should reject it.
        fields = {
            'title': 'x' * 100,  # 100 > max_length=60
            'bullet_1': '', 'bullet_2': '',
            'description': '', 'keyword_context': '',
        }
        from rest_framework.exceptions import ValidationError

        with pytest.raises(ValidationError):
            apply_to_listing(listing, fields)


# ---------------------------------------------------------------------------
# Module-level sanity
# ---------------------------------------------------------------------------

def test_expected_fields_matches_char_limits():
    """EXPECTED_FIELDS must be a subset of translator.CHAR_LIMITS keys so
    validate_and_truncate always finds a cap."""
    for field in ai_improve.EXPECTED_FIELDS:
        assert field in CHAR_LIMITS, f'{field} missing from CHAR_LIMITS'

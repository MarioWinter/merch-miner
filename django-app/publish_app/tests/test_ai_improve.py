"""Unit tests for ``publish_app.services.ai_improve``.

Covers the pure functions (``build_prompt``, ``call_llm``,
``validate_and_truncate``, ``apply_to_listing``) plus the cache-aware
``ensure_design_vision`` and DB-backed ``get_ai_improve_llm`` /
``get_design_vision_llm``. All LLM invocations are mocked -- no real
OpenRouter calls from tests.

Phase M1 extension (PROJ-11 AC-69..AC-72) -- cache on DesignAsset +
ListingImproveNodeConfig-driven model lookup. View/throttle tests land in
Phase M2+.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import DesignAsset, Listing, ListingImproveNodeConfig
from publish_app.services import ai_improve
from publish_app.services.ai_improve import (
    EXPECTED_FIELDS,
    NODE_AI_IMPROVE,
    NODE_DESIGN_VISION,
    VISION_FIELDS,
    AIImproveError,
    apply_to_listing,
    build_prompt,
    call_llm,
    ensure_design_vision,
    get_ai_improve_llm,
    get_design_vision_llm,
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


@pytest.fixture
def vision_context():
    """Representative cached vision dict (shape returned by ensure_design_vision)."""
    return {
        'analyzed_at': '2026-04-23T10:00:00+00:00',
        'model': 'openai/gpt-4.1-mini',
        'description': 'Vintage cat silhouette on a cream background.',
        'visual_style': 'retro, distressed',
        'graphic_elements': 'cat silhouette, stars',
        'layout_composition': 'centered text above cat',
        'dominant_colors': ['#f5f0e6', '#1a1a1a'],
        'detected_text': 'Cat Lovers Unite',
    }


# ---------------------------------------------------------------------------
# build_prompt (text-only, vision_context dict)
# ---------------------------------------------------------------------------

class TestBuildPrompt:
    def test_returns_system_plus_user_messages(self, listing, vision_context):
        messages = build_prompt(
            listing=listing,
            vision_context=vision_context,
            keyword_context='retro cat, vintage cat shirt',
            language='en',
        )
        assert isinstance(messages, list)
        assert len(messages) == 2
        assert messages[0]['role'] == 'system'
        assert messages[1]['role'] == 'user'

    def test_user_message_is_text_only(self, listing, vision_context):
        """No image_url parts -- vision context is embedded as text."""
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='en',
        )
        content = messages[1]['content']
        assert isinstance(content, str)

    def test_user_message_includes_keyword_context_hint(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='retro cat, vintage cat shirt',
            language='en',
        )
        text = messages[1]['content']
        assert 'retro cat, vintage cat shirt' in text

    def test_user_message_includes_existing_listing_copy(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='en',
        )
        text = messages[1]['content']
        assert 'Cat Lovers Unite' in text
        assert 'Premium cotton tee' in text
        assert 'For true cat enthusiasts.' in text

    def test_user_message_includes_vision_block(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='en',
        )
        text = messages[1]['content']
        # Each vision field label shows up, plus some of the values.
        for field in VISION_FIELDS:
            assert field in text
        assert 'Vintage cat silhouette' in text
        assert '#f5f0e6' in text

    def test_empty_vision_context_labelled_as_none(self, listing):
        messages = build_prompt(
            listing=listing, vision_context={},
            keyword_context='', language='en',
        )
        text = messages[1]['content']
        assert '(none)' in text

    def test_localizes_language_label(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='de',
        )
        text = messages[1]['content']
        assert 'German' in text
        assert '(de)' in text

    def test_unknown_language_falls_back_to_code(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='zz',
        )
        text = messages[1]['content']
        assert '(zz)' in text

    def test_char_limits_documented_in_prompt(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='en',
        )
        text = messages[1]['content']
        for field in EXPECTED_FIELDS:
            limit = CHAR_LIMITS[field]
            assert f'{field}: {limit} chars' in text

    def test_empty_keyword_context_shown_as_none(self, listing, vision_context):
        messages = build_prompt(
            listing=listing, vision_context=vision_context,
            keyword_context='', language='en',
        )
        text = messages[1]['content']
        assert '(none)' in text


# ---------------------------------------------------------------------------
# ensure_design_vision (cache-aware)
# ---------------------------------------------------------------------------

class TestEnsureDesignVision:
    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_cache_hit_skips_llm(self, mock_llm_cls, design):
        """Non-empty vision_analysis -> return as-is, zero LLM calls."""
        cached = {
            'analyzed_at': '2026-01-01T00:00:00+00:00',
            'model': 'openai/gpt-4.1-mini',
            'description': 'cached',
            'visual_style': 'retro',
            'graphic_elements': '',
            'layout_composition': '',
            'dominant_colors': [],
            'detected_text': '',
        }
        design.vision_analysis = cached
        design.save(update_fields=['vision_analysis'])

        result = ensure_design_vision(design)
        assert result == cached
        mock_llm_cls.assert_not_called()

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_cache_miss_runs_llm_and_persists(self, mock_llm_cls, design):
        mock_response = MagicMock()
        mock_response.content = json.dumps({
            'description': 'Vintage cat silhouette on cream bg.',
            'visual_style': 'retro, distressed',
            'graphic_elements': 'cat, stars',
            'layout_composition': 'centered text above cat',
            'dominant_colors': ['#f5f0e6', '#1a1a1a'],
            'detected_text': 'Cat Lovers Unite',
        })
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        result = ensure_design_vision(design)

        assert result['description'] == 'Vintage cat silhouette on cream bg.'
        assert result['dominant_colors'] == ['#f5f0e6', '#1a1a1a']
        assert 'analyzed_at' in result
        assert 'model' in result

        design.refresh_from_db()
        assert design.vision_analysis == result
        mock_llm.invoke.assert_called_once()

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_cache_miss_sends_image_url_to_vision_model(self, mock_llm_cls, design):
        mock_response = MagicMock()
        mock_response.content = '{"description": "x", "visual_style": "", "graphic_elements": "", "layout_composition": "", "dominant_colors": [], "detected_text": ""}'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        ensure_design_vision(design)

        messages = mock_llm.invoke.call_args.args[0]
        user_content = messages[1]['content']
        image_parts = [c for c in user_content if c.get('type') == 'image_url']
        assert len(image_parts) == 1
        assert image_parts[0]['image_url']['url'] == (
            'https://cdn.example.com/designs/cat.png'
        )

    def test_no_image_url_raises(self, workspace, user):
        design = DesignAsset.objects.create(
            workspace=workspace, file_name='t.png', created_by=user,
        )
        with pytest.raises(AIImproveError, match='no resolvable image URL'):
            ensure_design_vision(design)

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_non_json_response_raises(self, mock_llm_cls, design):
        mock_response = MagicMock()
        mock_response.content = 'Sorry I cannot analyze images today.'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        with pytest.raises(AIImproveError, match='non-JSON'):
            ensure_design_vision(design)

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_upstream_exception_wrapped(self, mock_llm_cls, design):
        mock_llm = MagicMock()
        mock_llm.invoke.side_effect = RuntimeError('Openrouter 502')
        mock_llm_cls.return_value = mock_llm

        with pytest.raises(AIImproveError, match='Vision LLM call failed'):
            ensure_design_vision(design)

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_dominant_colors_normalized_from_string(self, mock_llm_cls, design):
        """Robustness: LLM sometimes returns a single string instead of list."""
        mock_response = MagicMock()
        mock_response.content = json.dumps({
            'description': 'x',
            'visual_style': '',
            'graphic_elements': '',
            'layout_composition': '',
            'dominant_colors': '#ff0000',
            'detected_text': '',
        })
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        result = ensure_design_vision(design)
        assert result['dominant_colors'] == ['#ff0000']


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
# call_llm (mocked, DB config)
# ---------------------------------------------------------------------------

class TestCallLlm:
    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_returns_parsed_json_on_happy_path(self, mock_llm_cls, db):
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
    def test_non_json_response_raises_ai_improve_error(self, mock_llm_cls, db):
        mock_response = MagicMock()
        mock_response.content = 'Sorry, I cannot produce JSON today.'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        with pytest.raises(AIImproveError, match='non-JSON'):
            call_llm([])

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_json_wrapped_in_text_still_parses(self, mock_llm_cls, db):
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
    def test_upstream_exception_wrapped_in_ai_improve_error(
        self, mock_llm_cls, db,
    ):
        mock_llm = MagicMock()
        mock_llm.invoke.side_effect = RuntimeError('Openrouter 502')
        mock_llm_cls.return_value = mock_llm

        with pytest.raises(AIImproveError, match='LLM upstream call failed'):
            call_llm([])

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_reads_model_from_db_config(self, mock_llm_cls, db):
        """DB ListingImproveNodeConfig row wins over code defaults."""
        ListingImproveNodeConfig.objects.update_or_create(
            node_name=NODE_AI_IMPROVE,
            defaults={
                'model_name': 'anthropic/claude-3.5-sonnet',
                'temperature': 0.9,
                'max_tokens': 1234,
                'system_prompt': 'Custom admin prompt.',
            },
        )
        mock_response = MagicMock()
        mock_response.content = '{"title": "", "bullet_1": "", "bullet_2": "", "description": "", "keyword_context": ""}'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        call_llm([])

        kwargs = mock_llm_cls.call_args.kwargs
        assert kwargs['model'] == 'anthropic/claude-3.5-sonnet'
        assert kwargs['temperature'] == 0.9
        assert kwargs['max_tokens'] == 1234

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_falls_back_to_code_defaults_when_config_missing(
        self, mock_llm_cls, db,
    ):
        ListingImproveNodeConfig.objects.filter(
            node_name=NODE_AI_IMPROVE,
        ).delete()

        mock_response = MagicMock()
        mock_response.content = '{"title": "", "bullet_1": "", "bullet_2": "", "description": "", "keyword_context": ""}'
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        call_llm([])

        kwargs = mock_llm_cls.call_args.kwargs
        assert kwargs['model'] == 'openai/gpt-4.1-mini'
        assert kwargs['temperature'] == 0.7


# ---------------------------------------------------------------------------
# LLM factory helpers
# ---------------------------------------------------------------------------

class TestLlmFactoryHelpers:
    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_get_ai_improve_llm_returns_llm_and_prompt(self, mock_llm_cls, db):
        ListingImproveNodeConfig.objects.update_or_create(
            node_name=NODE_AI_IMPROVE,
            defaults={
                'model_name': 'openai/gpt-4.1-mini',
                'temperature': 0.7,
                'max_tokens': 2000,
                'system_prompt': 'Admin-overridden AI improve prompt.',
            },
        )
        mock_llm_cls.return_value = MagicMock()
        llm, prompt = get_ai_improve_llm()
        assert llm is not None
        assert prompt == 'Admin-overridden AI improve prompt.'
        kwargs = mock_llm_cls.call_args.kwargs
        assert kwargs['model'] == 'openai/gpt-4.1-mini'
        # JSON mode is enforced for the text-only rewrite.
        assert kwargs['model_kwargs'] == {
            'response_format': {'type': 'json_object'},
        }

    @patch('publish_app.services.ai_improve.ChatOpenAI')
    def test_get_design_vision_llm_uses_own_config_row(
        self, mock_llm_cls, db,
    ):
        ListingImproveNodeConfig.objects.update_or_create(
            node_name=NODE_DESIGN_VISION,
            defaults={
                'model_name': 'openai/gpt-4.1-mini',
                'temperature': 0.1,
                'max_tokens': 1500,
                'system_prompt': 'Custom vision prompt.',
            },
        )
        mock_llm_cls.return_value = MagicMock()
        _, prompt = get_design_vision_llm()
        assert prompt == 'Custom vision prompt.'
        kwargs = mock_llm_cls.call_args.kwargs
        assert kwargs['temperature'] == 0.1


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

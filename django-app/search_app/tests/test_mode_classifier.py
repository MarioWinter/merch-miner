"""Tests for search_app.services.mode_classifier — auto-mode router.

Mocks `httpx.Client` (the context manager used inside the function) so no
network is required. Exercises:
    * Routing decisions (web_search vs. agent).
    * niche_context inclusion in the user prompt payload.
    * Missing API key → ModeClassifierError.
    * Timeout / HTTP error / invalid JSON → ModeClassifierError.
    * Unknown mode in LLM output → fallback to 'web_search'.
    * Confidence float parsing & reason truncation (>300 chars).
    * User message > 1000 chars truncated.
    * SYSTEM_PROMPT delivered as the 'system' role message.
"""
import json
from unittest.mock import MagicMock, patch

import httpx
import pytest
from django.test import override_settings

from search_app.services.mode_classifier import (
    SYSTEM_PROMPT,
    ModeClassifierError,
    classify_mode,
)


def _build_response(content: str | dict, status_code: int = 200):
    """Construct a MagicMock that mimics httpx.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = content if isinstance(content, str) else json.dumps(content)
    if isinstance(content, dict):
        resp.json.return_value = content
    else:
        # Top-level JSON wrapper for OpenRouter chat-completions
        resp.json.return_value = {
            'choices': [{'message': {'content': content}}],
        }
    if status_code >= 400:
        err = httpx.HTTPStatusError(
            f'{status_code}', request=MagicMock(), response=resp,
        )
        resp.raise_for_status.side_effect = err
    else:
        resp.raise_for_status.return_value = None
    return resp


def _patch_client(post_return_value=None, post_side_effect=None):
    """Patch httpx.Client used inside classify_mode."""
    mock_client = MagicMock()
    if post_side_effect is not None:
        mock_client.post.side_effect = post_side_effect
    else:
        mock_client.post.return_value = post_return_value

    cm = MagicMock()
    cm.__enter__.return_value = mock_client
    cm.__exit__.return_value = False
    return patch(
        'search_app.services.mode_classifier.httpx.Client',
        return_value=cm,
    ), mock_client


# ---------------------------------------------------------------------------
# Routing decisions
# ---------------------------------------------------------------------------
class TestModeClassifierRouting:

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_factual_query_returns_web_search(self):
        resp = _build_response(
            '{"mode": "web_search", "confidence": 0.95, "reason": "factual"}',
        )
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher:
            out = classify_mode("What is the BSR of camping shirts on Amazon?")
        assert out['mode'] == 'web_search'
        assert out['confidence'] == 0.95
        assert out['reason'] == 'factual'

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_multistep_command_returns_agent(self):
        resp = _build_response(
            '{"mode": "agent", "confidence": 0.9, "reason": "multi-step"}',
        )
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher:
            out = classify_mode(
                "Recherchiere die Camping-Niche und erstelle 5 Designs",
            )
        assert out['mode'] == 'agent'
        assert out['confidence'] == 0.9


# ---------------------------------------------------------------------------
# Payload assertions
# ---------------------------------------------------------------------------
class TestModeClassifierPayload:

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_niche_context_in_user_prompt(self):
        resp = _build_response(
            '{"mode": "web_search", "confidence": 0.7, "reason": "ok"}',
        )
        patcher, mock_client = _patch_client(post_return_value=resp)
        with patcher:
            classify_mode("trend lookup", niche_context_name="Camping Dad")

        _, kwargs = mock_client.post.call_args
        payload = kwargs['json']
        # System message present at index 0
        assert payload['messages'][0]['role'] == 'system'
        assert payload['messages'][0]['content'] == SYSTEM_PROMPT
        # User message contains the niche context tag
        user_msg = payload['messages'][1]['content']
        assert payload['messages'][1]['role'] == 'user'
        assert '[Niche context: Camping Dad]' in user_msg
        assert 'trend lookup' in user_msg

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_long_user_message_truncated_to_1000(self):
        resp = _build_response(
            '{"mode": "web_search", "confidence": 0.5, "reason": "ok"}',
        )
        patcher, mock_client = _patch_client(post_return_value=resp)
        long_msg = 'x' * 5000
        with patcher:
            classify_mode(long_msg)

        _, kwargs = mock_client.post.call_args
        payload = kwargs['json']
        user_content = payload['messages'][1]['content']
        # No niche prefix; full string capped at 1000.
        assert len(user_content) == 1000
        assert user_content == 'x' * 1000

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_system_prompt_is_first_message(self):
        resp = _build_response(
            '{"mode": "agent", "confidence": 0.6, "reason": "x"}',
        )
        patcher, mock_client = _patch_client(post_return_value=resp)
        with patcher:
            classify_mode("any input")

        _, kwargs = mock_client.post.call_args
        payload = kwargs['json']
        assert len(payload['messages']) == 2
        assert payload['messages'][0]['role'] == 'system'
        assert payload['messages'][1]['role'] == 'user'


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------
class TestModeClassifierErrors:

    @override_settings(OPENROUTER_API_KEY='')
    def test_missing_api_key_raises(self):
        with pytest.raises(ModeClassifierError, match='OPENROUTER_API_KEY'):
            classify_mode("hello")

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_timeout_raises_classifier_error(self):
        patcher, _ = _patch_client(
            post_side_effect=httpx.TimeoutException('boom'),
        )
        with patcher, pytest.raises(ModeClassifierError, match='timed out'):
            classify_mode("query")

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_http_500_raises_with_status_code(self):
        resp = _build_response('Server error', status_code=500)
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher, pytest.raises(ModeClassifierError, match='500'):
            classify_mode("query")

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_invalid_json_response_raises(self):
        resp = _build_response('not-json-at-all')
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher, pytest.raises(
            ModeClassifierError, match='invalid response',
        ):
            classify_mode("query")

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_generic_exception_wrapped(self):
        patcher, _ = _patch_client(post_side_effect=ValueError('oops'))
        with patcher, pytest.raises(ModeClassifierError, match='Classifier failed'):
            classify_mode("query")


# ---------------------------------------------------------------------------
# Output sanitization
# ---------------------------------------------------------------------------
class TestModeClassifierOutput:

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_unknown_mode_falls_back_to_web_search(self):
        resp = _build_response(
            '{"mode": "random", "confidence": 0.4, "reason": "weird"}',
        )
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher:
            out = classify_mode("query")
        assert out['mode'] == 'web_search'

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_confidence_parsed_as_float(self):
        resp = _build_response(
            '{"mode": "web_search", "confidence": 0.95, "reason": "x"}',
        )
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher:
            out = classify_mode("query")
        assert isinstance(out['confidence'], float)
        assert out['confidence'] == 0.95

    @override_settings(OPENROUTER_API_KEY='sk-test')
    def test_reason_truncated_to_300_chars(self):
        long_reason = 'r' * 1000
        resp = _build_response(
            json.dumps({
                'mode': 'web_search',
                'confidence': 0.5,
                'reason': long_reason,
            }),
        )
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher:
            out = classify_mode("query")
        assert len(out['reason']) == 300
        assert out['reason'] == 'r' * 300

    def test_default_confidence_when_missing(self):
        resp = _build_response('{"mode": "agent"}')
        patcher, _ = _patch_client(post_return_value=resp)
        with patcher:
            out = classify_mode("query")
        # Falls back to 0.5 when LLM forgets confidence.
        assert out['confidence'] == 0.5
        assert out['reason'] == ''

    def test_missing_choices_key_raises(self):
        # Mock returns {} with no 'choices' → KeyError → ModeClassifierError
        bad_resp = MagicMock()
        bad_resp.status_code = 200
        bad_resp.raise_for_status.return_value = None
        bad_resp.json.return_value = {}
        patcher, _ = _patch_client(post_return_value=bad_resp)
        with patcher, pytest.raises(
            ModeClassifierError, match='invalid response',
        ):
            classify_mode("query")

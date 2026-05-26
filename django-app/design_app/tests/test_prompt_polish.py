"""PROJ-34 Phase 4 — tests for prompt_polish.polish_prompt().

Covers happy path, timeout (with retry), 5xx, empty / no-op response,
oversize truncation, and the OPENROUTER-not-configured passthrough.
"""

from unittest.mock import MagicMock, patch

import httpx

from design_app.services.prompt_polish import (
    POLISH_MAX_OUTPUT_CHARS,
    polish_prompt,
)


def _ok_response(text: str) -> dict:
    return {
        'choices': [{'message': {'content': text}}],
        'usage': {'prompt_tokens': 10, 'completion_tokens': 20, 'total_tokens': 30},
    }


def _patch_settings():
    return patch(
        'design_app.services.prompt_polish.settings',
        OPENROUTER_API_KEY='k',
        OPENROUTER_BASE_URL='https://openrouter.ai/api/v1',
        LANGFUSE_PUBLIC_KEY='',
        LANGFUSE_SECRET_KEY='',
    )


def _mock_client(mock_client_cls, resp_or_exc):
    mock_client = MagicMock()
    if isinstance(resp_or_exc, Exception):
        mock_client.post.side_effect = resp_or_exc
    else:
        mock_client.post.return_value = resp_or_exc
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client_cls.return_value = mock_client
    return mock_client


class TestPolishPromptHappyPath:
    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_happy_path_returns_polished(self, mock_client_cls):
        resp = MagicMock()
        resp.status_code = 200
        resp.json.return_value = _ok_response('Polished version of the prompt.')
        resp.raise_for_status = MagicMock()
        _mock_client(mock_client_cls, resp)
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'Polished version of the prompt.'

    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_unchanged_output_falls_through_to_raw(self, mock_client_cls):
        """EC-6: polished == raw → return raw."""
        resp = MagicMock()
        resp.json.return_value = _ok_response('raw prompt')
        resp.raise_for_status = MagicMock()
        _mock_client(mock_client_cls, resp)
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'raw prompt'

    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_empty_output_falls_through_to_raw(self, mock_client_cls):
        """EC-6: empty model output → raw."""
        resp = MagicMock()
        resp.json.return_value = _ok_response('   ')
        resp.raise_for_status = MagicMock()
        _mock_client(mock_client_cls, resp)
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'raw prompt'

    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_oversize_output_truncated_to_sentence(self, mock_client_cls):
        """EC-5: > 2000 chars → trim to last sentence boundary."""
        # Build deterministic text: many filler sentences then one past the limit.
        long_text = (
            ('Sentence is here. ' * 200)  # ~3600 chars, many '. ' boundaries
            + 'Trailing remainder past the cap.'
        )
        resp = MagicMock()
        resp.json.return_value = _ok_response(long_text)
        resp.raise_for_status = MagicMock()
        _mock_client(mock_client_cls, resp)
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert len(result) <= POLISH_MAX_OUTPUT_CHARS
        assert result.endswith('. ') or result.endswith('.')


class TestPolishPromptFailureModes:
    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_timeout_then_success_returns_polished(self, mock_client_cls):
        """AC-19: one retry on timeout — second attempt succeeds."""
        resp_ok = MagicMock()
        resp_ok.json.return_value = _ok_response('polished after retry')
        resp_ok.raise_for_status = MagicMock()
        mock_client = MagicMock()
        # First call raises TimeoutException, second returns success.
        mock_client.post.side_effect = [
            httpx.TimeoutException('slow'),
            resp_ok,
        ]
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_client
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'polished after retry'

    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_double_timeout_returns_raw(self, mock_client_cls):
        """AC-18: both attempts time out → silently return raw input."""
        _mock_client(mock_client_cls, httpx.TimeoutException('slow'))
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'raw prompt'

    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_5xx_returns_raw(self, mock_client_cls):
        """AC-18: 5xx → passthrough."""
        resp = MagicMock()
        resp.status_code = 503
        resp.text = 'upstream down'
        err = httpx.HTTPStatusError('503', request=MagicMock(), response=resp)
        resp.raise_for_status = MagicMock(side_effect=err)
        _mock_client(mock_client_cls, resp)
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'raw prompt'

    @patch('design_app.services.prompt_polish.httpx.Client')
    def test_arbitrary_exception_returns_raw(self, mock_client_cls):
        """AC-18: never raise — any other exception → raw."""
        _mock_client(mock_client_cls, RuntimeError('network gone'))
        with _patch_settings():
            result = polish_prompt('raw prompt')
        assert result == 'raw prompt'

    def test_missing_openrouter_config_returns_raw(self):
        """Polish gracefully passes through when OPENROUTER not configured."""
        with patch(
            'design_app.services.prompt_polish.settings',
            OPENROUTER_API_KEY='',
            OPENROUTER_BASE_URL='',
            LANGFUSE_PUBLIC_KEY='',
            LANGFUSE_SECRET_KEY='',
        ):
            result = polish_prompt('raw prompt')
        assert result == 'raw prompt'

    def test_empty_input_returns_empty(self):
        """Edge: empty / whitespace input → no API call, return as-is."""
        with _patch_settings():
            assert polish_prompt('') == ''
            assert polish_prompt('   ') == '   '

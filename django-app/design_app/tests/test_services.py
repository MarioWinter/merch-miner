"""Tests for design_app services."""

import base64
from unittest.mock import MagicMock, patch

import pytest

from design_app.services.prompt_builder import build_from_analysis, build_from_idea


class TestPromptBuilder:
    def test_build_from_analysis_with_final_prompt(self):
        analysis = {
            'text_dna': {'text': 'Coffee Lover'},
            'final_prompt': 'Bold serif "Coffee Lover", coffee beans, vintage style',
        }
        result = build_from_analysis(analysis, 'light_gray')
        assert 'Coffee Lover' in result
        assert '#D3D3D3' in result
        assert 'no gradients' in result

    def test_build_from_analysis_fallback(self):
        analysis = {
            'text_dna': {'text': 'Hello', 'font_style': 'bold serif'},
            'visual': {'style': 'vintage', 'elements': 'coffee beans'},
            'style': {'aesthetic': 'retro'},
        }
        result = build_from_analysis(analysis, 'neon_pink')
        assert 'Hello' in result
        assert '#FF6EC7' in result
        assert 'print resolution' in result

    def test_build_from_analysis_empty(self):
        result = build_from_analysis({}, 'neon_green')
        assert '#39FF14' in result

    def test_build_from_idea_basic(self):
        class MockIdea:
            slogan_text = 'Best Dad Ever'
            emotional_archetype = 'warm'

        result = build_from_idea(MockIdea(), 'light_gray')
        assert 'Best Dad Ever' in result
        assert '#D3D3D3' in result

    def test_build_from_idea_with_references(self):
        class MockIdea:
            slogan_text = 'Dog Mom'
            emotional_archetype = ''

        refs = [
            {
                'visual_style': 'minimalist',
                'graphic_elements': 'paw print',
                'vibe': {'primary': 'playful'},
                'tone': 'humorous',
            },
        ]
        result = build_from_idea(MockIdea(), 'neon_green', reference_analyses=refs)
        assert 'Dog Mom' in result
        assert 'minimalist' in result
        assert 'paw print' in result


class TestGenerateImage:
    """Tests for generate_image() — multimodal content and validation."""

    def _make_response(self, b64_data):
        """Build a minimal OpenRouter response with base64 image."""
        return {
            'choices': [{
                'message': {
                    'content': [
                        {
                            'inline_data': {
                                'data': b64_data,
                                'mime_type': 'image/png',
                            },
                        },
                    ],
                },
            }],
        }

    @patch('design_app.services.image_generator.httpx.Client')
    def test_multimodal_content_array(self, mock_client_cls, tmp_path):
        """Multimodal model + source_image_url sends content as array."""
        from design_app.services.image_generator import generate_image

        # Create a tiny valid PNG (1x1 pixel)
        from PIL import Image
        from io import BytesIO
        buf = BytesIO()
        Image.new('RGBA', (1, 1), (255, 0, 0, 255)).save(buf, 'PNG')
        png_bytes = buf.getvalue()
        b64_data = base64.b64encode(png_bytes).decode()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self._make_response(b64_data)
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.post.return_value = mock_resp
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

            result = generate_image(
                prompt='Coffee design',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
                source_image_url='https://example.com/ref.jpg',
            )

        assert result.endswith('.png')

        # Verify payload sent to API had multimodal content array
        call_args = mock_client.post.call_args
        payload = call_args.kwargs['json']
        content = payload['messages'][0]['content']
        assert isinstance(content, list)
        assert len(content) == 2
        assert content[0]['type'] == 'text'
        assert content[0]['text'] == 'Coffee design'
        assert content[1]['type'] == 'image_url'
        assert content[1]['image_url']['url'] == 'https://example.com/ref.jpg'

    @patch('design_app.services.image_generator.httpx.Client')
    def test_text_only_content(self, mock_client_cls, tmp_path):
        """Without source_image_url, content is plain string."""
        from design_app.services.image_generator import generate_image
        from PIL import Image
        from io import BytesIO

        buf = BytesIO()
        Image.new('RGBA', (1, 1)).save(buf, 'PNG')
        b64_data = base64.b64encode(buf.getvalue()).decode()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self._make_response(b64_data)
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.post.return_value = mock_resp
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_client

        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

            generate_image(
                prompt='Simple text prompt',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
            )

        call_args = mock_client.post.call_args
        payload = call_args.kwargs['json']
        content = payload['messages'][0]['content']
        assert isinstance(content, str)
        assert content == 'Simple text prompt'

    def test_non_multimodal_model_with_source_image_raises(self):
        """Non-multimodal model + source_image_url raises ValueError."""
        from design_app.services.image_generator import generate_image

        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

            with pytest.raises(ValueError, match='does not support image input'):
                generate_image(
                    prompt='Test prompt with image',
                    model_name='flux',
                    source_image_url='https://example.com/img.jpg',
                )

    def test_non_multimodal_model_seedream_with_source_image_raises(self):
        """Seedream (non-multimodal) + source_image_url raises ValueError."""
        from design_app.services.image_generator import generate_image

        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

            with pytest.raises(ValueError, match='does not support image input'):
                generate_image(
                    prompt='Test prompt with image',
                    model_name='bytedance-seed/seedream-4.5',
                    source_image_url='https://example.com/img.jpg',
                )

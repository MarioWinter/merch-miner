"""Tests for design_app services."""

import base64
import os
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from design_app.services.prompt_builder import build_from_analysis, build_from_idea

pytestmark = pytest.mark.django_db


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

    def test_i2i_mode_missing_source_url_raises(self):
        """image_to_image mode without source_image_url raises ValueError."""
        from design_app.services.image_generator import generate_image

        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

            with pytest.raises(ValueError, match='source_image_url required'):
                generate_image(
                    prompt='Remix this design',
                    model_name='gemini_flash',
                    mode='image_to_image',
                )

    def test_i2i_mode_non_multimodal_model_raises(self):
        """image_to_image mode with non-multimodal model raises ValueError."""
        from design_app.services.image_generator import generate_image

        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

            with pytest.raises(ValueError, match='does not support image input'):
                generate_image(
                    prompt='Remix this design',
                    model_name='flux',
                    mode='image_to_image',
                    source_image_url='https://example.com/ref.jpg',
                )

    @patch('design_app.services.image_generator.httpx.Client')
    def test_i2i_prompt_wrapping(self, mock_client_cls, tmp_path):
        """image_to_image mode wraps prompt and puts image first."""
        from design_app.services.image_generator import generate_image
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
                prompt='Make it brighter',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
                source_image_url='https://example.com/ref.jpg',
                mode='image_to_image',
            )

        call_args = mock_client.post.call_args
        payload = call_args.kwargs['json']
        content = payload['messages'][0]['content']
        assert isinstance(content, list)
        assert len(content) == 2
        # Image comes first in i2i mode
        assert content[0]['type'] == 'image_url'
        assert content[0]['image_url']['url'] == 'https://example.com/ref.jpg'
        # Text wraps user prompt with i2i instructions
        assert content[1]['type'] == 'text'
        assert 'reference image' in content[1]['text'].lower()
        assert 'Make it brighter' in content[1]['text']

    @patch('design_app.services.image_generator.httpx.Client')
    def test_t2i_with_source_keeps_text_first(self, mock_client_cls, tmp_path):
        """text_to_image mode with source_image_url keeps text first."""
        from design_app.services.image_generator import generate_image
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
                prompt='Coffee design',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
                source_image_url='https://example.com/ref.jpg',
                mode='text_to_image',
            )

        call_args = mock_client.post.call_args
        payload = call_args.kwargs['json']
        content = payload['messages'][0]['content']
        assert isinstance(content, list)
        # Text-to-image: text comes first
        assert content[0]['type'] == 'text'
        assert content[0]['text'] == 'Coffee design'
        assert content[1]['type'] == 'image_url'


class TestBgRemoverService:
    """Tests for design_app.services.bg_remover."""

    @patch('rembg.remove')
    @patch('design_app.services.bg_remover._get_session')
    def test_remove_background_rembg_success(
        self, mock_get_session, mock_remove, tmp_path,
    ):
        from design_app.services.bg_remover import remove_background_rembg

        input_img = Image.new('RGBA', (100, 100), (255, 0, 0, 255))
        input_path = str(tmp_path / 'test_input.png')
        input_img.save(input_path, 'PNG')

        output_img = Image.new('RGBA', (100, 100), (0, 0, 0, 0))
        mock_remove.return_value = output_img
        mock_get_session.return_value = MagicMock()

        result = remove_background_rembg(input_path, model_name='birefnet-general-lite')

        assert result.endswith('_nobg.png')
        assert os.path.exists(result)
        mock_get_session.assert_called_with('birefnet-general-lite')
        mock_remove.assert_called_once()

        # Verify output is valid PNG
        with Image.open(result) as img:
            assert img.mode == 'RGBA'

    @patch('rembg.remove')
    @patch('design_app.services.bg_remover._get_session')
    def test_invalid_model_falls_back_to_default(
        self, mock_get_session, mock_remove, tmp_path,
    ):
        from design_app.services.bg_remover import remove_background_rembg, DEFAULT_MODEL

        input_img = Image.new('RGBA', (50, 50))
        input_path = str(tmp_path / 'test.png')
        input_img.save(input_path, 'PNG')

        mock_remove.return_value = Image.new('RGBA', (50, 50))
        mock_get_session.return_value = MagicMock()

        remove_background_rembg(input_path, model_name='nonexistent-model')
        mock_get_session.assert_called_with(DEFAULT_MODEL)

    def test_default_model_is_birefnet_general_lite(self):
        from design_app.services.bg_remover import DEFAULT_MODEL
        assert DEFAULT_MODEL == 'birefnet-general-lite'

    def test_allowed_models_contains_expected(self):
        from design_app.services.bg_remover import ALLOWED_MODELS
        assert 'birefnet-general-lite' in ALLOWED_MODELS
        assert 'birefnet-general' in ALLOWED_MODELS
        assert 'u2net' in ALLOWED_MODELS
        assert 'silueta' in ALLOWED_MODELS
        assert 'nonexistent' not in ALLOWED_MODELS

    def test_remove_background_api_raises(self):
        from design_app.services.bg_remover import remove_background_api
        with pytest.raises(NotImplementedError, match='not yet configured'):
            remove_background_api('/fake/path.png', 'some-key')


class TestUpscalerService:
    """Tests for design_app.services.upscaler."""

    def test_check_dimensions(self, tmp_path):
        from design_app.services.upscaler import check_dimensions

        img = Image.new('RGB', (1920, 1080))
        path = str(tmp_path / 'dim_test.png')
        img.save(path, 'PNG')

        w, h = check_dimensions(path)
        assert w == 1920
        assert h == 1080

    def test_should_use_client_below_threshold(self, tmp_path):
        from design_app.services.upscaler import should_use_client

        img = Image.new('RGB', (2999, 2000))
        path = str(tmp_path / 'small.png')
        img.save(path, 'PNG')

        assert should_use_client(path, threshold=3000) is False

    def test_should_use_client_at_threshold(self, tmp_path):
        from design_app.services.upscaler import should_use_client

        img = Image.new('RGB', (3000, 2000))
        path = str(tmp_path / 'exact.png')
        img.save(path, 'PNG')

        assert should_use_client(path, threshold=3000) is True

    def test_should_use_client_above_threshold(self, tmp_path):
        from design_app.services.upscaler import should_use_client

        img = Image.new('RGB', (3001, 2000))
        path = str(tmp_path / 'large.png')
        img.save(path, 'PNG')

        assert should_use_client(path, threshold=3000) is True

    def test_should_use_client_height_exceeds(self, tmp_path):
        """Height alone exceeding threshold triggers client routing."""
        from design_app.services.upscaler import should_use_client

        img = Image.new('RGB', (1000, 4000))
        path = str(tmp_path / 'tall.png')
        img.save(path, 'PNG')

        assert should_use_client(path, threshold=3000) is True

    def test_get_upscale_decision_client(self, tmp_path):
        from design_app.services.upscaler import get_upscale_decision

        img = Image.new('RGB', (4500, 5400))
        path = str(tmp_path / 'big.png')
        img.save(path, 'PNG')

        decision = get_upscale_decision(path, threshold=3000)
        assert decision['route'] == 'client'
        assert decision['current_dimensions'] == [4500, 5400]
        assert decision['threshold'] == 3000

    def test_get_upscale_decision_server(self, tmp_path):
        from design_app.services.upscaler import get_upscale_decision

        img = Image.new('RGB', (800, 600))
        path = str(tmp_path / 'tiny.png')
        img.save(path, 'PNG')

        decision = get_upscale_decision(path, threshold=3000)
        assert decision['route'] == 'server'
        assert decision['current_dimensions'] == [800, 600]

    def test_upscale_api_raises(self):
        from design_app.services.upscaler import upscale_api
        with pytest.raises(NotImplementedError, match='not yet configured'):
            upscale_api('/fake/path.png', 'some-key')


class TestTaskRemoveBackground:
    """Tests for task_remove_background in tasks.py."""

    @pytest.fixture
    def _bg_setup(self, tmp_path):
        """Shared setup for bg removal task tests."""
        from workspace_app.models import Workspace
        from idea_app.models import Idea
        from design_app.models import Design, DesignProcessingJob
        from django.contrib.auth import get_user_model
        from django.core.files.base import ContentFile

        User = get_user_model()
        user = User.objects.create_user(
            email='taskbg@example.com', password='testpass',
        )
        ws = Workspace.objects.create(name='Task WS', slug='task-bg', owner=user)
        idea = Idea.objects.create(workspace=ws, slogan_text='X', created_by=user)

        from io import BytesIO
        buf = BytesIO()
        Image.new('RGBA', (100, 100)).save(buf, 'PNG')
        buf.seek(0)

        design = Design.objects.create(workspace=ws, idea=idea)
        design.image_file.save('test_design.png', ContentFile(buf.read()), save=True)

        job = DesignProcessingJob.objects.create(design=design, type='bg_remove')
        self.design = design
        self.job = job
        self.tmp_path = tmp_path

    @patch('design_app.services.bg_remover.remove_background_rembg')
    def test_task_uses_rembg_by_default(self, mock_rembg, _bg_setup):
        mock_output = str(self.tmp_path / 'nobg.png')
        Image.new('RGBA', (100, 100)).save(mock_output, 'PNG')
        mock_rembg.return_value = mock_output

        from design_app.tasks import task_remove_background
        task_remove_background(str(self.job.id), model_name='birefnet-general-lite')

        self.job.refresh_from_db()
        assert self.job.status == 'completed'
        mock_rembg.assert_called_once()
        call_kwargs = mock_rembg.call_args
        assert call_kwargs[1]['model_name'] == 'birefnet-general-lite'

    @patch('design_app.services.bg_remover.remove_background_rembg')
    def test_task_failure_marks_job_failed(self, mock_rembg, _bg_setup):
        mock_rembg.side_effect = RuntimeError('rembg crashed')

        from design_app.tasks import task_remove_background
        task_remove_background(str(self.job.id))

        self.job.refresh_from_db()
        assert self.job.status == 'failed'
        assert 'rembg crashed' in self.job.error_message


class TestTaskUpscaleDesign:
    """Tests for task_upscale_design in tasks.py."""

    @pytest.fixture
    def _upscale_setup(self):
        """Shared setup for upscale task tests."""
        from workspace_app.models import Workspace
        from idea_app.models import Idea
        from design_app.models import Design, DesignProcessingJob
        from django.contrib.auth import get_user_model
        from django.core.files.base import ContentFile
        from io import BytesIO

        User = get_user_model()
        user = User.objects.create_user(
            email='taskup@example.com', password='testpass',
        )
        ws = Workspace.objects.create(name='Up WS', slug='task-up', owner=user)
        idea = Idea.objects.create(workspace=ws, slogan_text='X', created_by=user)

        buf = BytesIO()
        Image.new('RGB', (1000, 1000)).save(buf, 'PNG')
        buf.seek(0)

        design = Design.objects.create(workspace=ws, idea=idea)
        design.image_file.save('test_upscale.png', ContentFile(buf.read()), save=True)

        job = DesignProcessingJob.objects.create(design=design, type='upscale')
        self.design = design
        self.job = job

    @patch('design_app.services.upscaler.get_upscale_decision')
    def test_task_routes_to_client(self, mock_decision, _upscale_setup):
        mock_decision.return_value = {
            'route': 'client',
            'current_dimensions': [4500, 5400],
            'threshold': 3000,
        }

        from design_app.tasks import task_upscale_design
        task_upscale_design(str(self.job.id))

        self.job.refresh_from_db()
        assert self.job.status == 'completed'
        assert self.job.error_message == 'route:client'

    @patch('design_app.services.upscaler.get_upscale_decision')
    def test_task_server_route_raises_not_implemented(self, mock_decision, _upscale_setup):
        """Server route with no API configured fails gracefully."""
        mock_decision.return_value = {
            'route': 'server',
            'current_dimensions': [800, 600],
            'threshold': 3000,
        }

        from design_app.tasks import task_upscale_design
        task_upscale_design(str(self.job.id))

        self.job.refresh_from_db()
        assert self.job.status == 'failed'
        assert 'not yet configured' in self.job.error_message.lower()


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

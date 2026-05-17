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


@pytest.fixture
def _passthrough_data_url():
    """Patch _to_data_url to leave URLs unchanged.

    Tests assert structural shape of the content array (e.g. result[0]['image_url']['url'])
    and don't care about base64 inlining. Without this fixture they would try to fetch
    test URLs over the network or trip over the mocked httpx.Client returning MagicMocks.
    """
    with patch(
        'design_app.services.image_generator._to_data_url',
        side_effect=lambda url: url,
    ):
        yield


class TestGenerateImage:
    """Tests for generate_image() — multimodal content and validation."""

    @pytest.fixture(autouse=True)
    def _autouse_passthrough(self, _passthrough_data_url):
        yield

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
        # PROJ-34 AC-2: messages[0] is the system prompt; user is at [1].
        assert payload['messages'][0]['role'] == 'system'
        content = payload['messages'][1]['content']
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
        # PROJ-34 AC-2: messages[0] is the system prompt; user is at [1].
        assert payload['messages'][0]['role'] == 'system'
        content = payload['messages'][1]['content']
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
        # PROJ-34 AC-2: messages[0] is the system prompt; user is at [1].
        assert payload['messages'][0]['role'] == 'system'
        content = payload['messages'][1]['content']
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
        # PROJ-34 AC-2: messages[0] is the system prompt; user is at [1].
        assert payload['messages'][0]['role'] == 'system'
        content = payload['messages'][1]['content']
        assert isinstance(content, list)
        # Text-to-image: text comes first
        assert content[0]['type'] == 'text'
        assert content[0]['text'] == 'Coffee design'
        assert content[1]['type'] == 'image_url'


class TestBuildContent:
    """Tests for _build_content helper — verifies content arrays per mode."""

    @pytest.fixture(autouse=True)
    def _autouse_passthrough(self, _passthrough_data_url):
        yield

    def test_text_to_image_no_image(self):
        from design_app.services.image_generator import _build_content
        result = _build_content('text_to_image', 'A cool design')
        assert result == 'A cool design'

    def test_text_to_image_with_optional_reference(self):
        from design_app.services.image_generator import _build_content
        result = _build_content(
            'text_to_image', 'A cool design',
            source_image_url='https://example.com/ref.jpg',
        )
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]['type'] == 'text'
        assert result[0]['text'] == 'A cool design'
        assert result[1]['type'] == 'image_url'

    def test_image_to_image_prompt_dominates(self):
        from design_app.services.image_generator import _build_content
        result = _build_content(
            'image_to_image', 'Make a cat design',
            source_image_url='https://example.com/ref.jpg',
        )
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]['type'] == 'image_url'
        assert result[0]['image_url']['url'] == 'https://example.com/ref.jpg'
        assert result[1]['type'] == 'text'
        assert 'style and mood guide' in result[1]['text']
        assert 'follow the prompt for content' in result[1]['text']
        assert 'Make a cat design' in result[1]['text']

    def test_image_to_image_edit_image_dominates(self):
        from design_app.services.image_generator import _build_content
        result = _build_content(
            'image_to_image_edit', 'Change the color to blue',
            source_image_url='https://example.com/ref.jpg',
        )
        assert isinstance(result, list)
        assert len(result) == 2
        assert result[0]['type'] == 'image_url'
        assert result[1]['type'] == 'text'
        assert 'Stay very close' in result[1]['text']
        assert 'minor modifications' in result[1]['text']
        assert 'Change the color to blue' in result[1]['text']

    def test_remix_two_images_plus_prompt(self):
        from design_app.services.image_generator import _build_content
        result = _build_content(
            'remix', 'Blend these styles',
            source_image_url='https://example.com/a.jpg',
            source_image_url_2='https://example.com/b.jpg',
        )
        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0]['type'] == 'image_url'
        assert result[0]['image_url']['url'] == 'https://example.com/a.jpg'
        assert result[1]['type'] == 'image_url'
        assert result[1]['image_url']['url'] == 'https://example.com/b.jpg'
        assert result[2]['type'] == 'text'
        assert 'both reference images' in result[2]['text']
        assert 'Blend these styles' in result[2]['text']


class TestGenerateImageModeValidation:
    """Tests for generate_image() validation across all 4 modes."""

    def _patch_settings(self):
        return patch(
            'design_app.services.image_generator.settings',
            OPENROUTER_API_KEY='test-key',
            OPENROUTER_BASE_URL='https://openrouter.ai/api/v1',
        )

    def test_image_to_image_edit_missing_url_raises(self):
        from design_app.services.image_generator import generate_image
        with self._patch_settings():
            with pytest.raises(ValueError, match='source_image_url required'):
                generate_image(
                    prompt='Edit this slightly',
                    model_name='gemini_flash',
                    mode='image_to_image_edit',
                )

    def test_image_to_image_edit_non_multimodal_raises(self):
        from design_app.services.image_generator import generate_image
        with self._patch_settings():
            with pytest.raises(ValueError, match='does not support image input'):
                generate_image(
                    prompt='Edit this slightly',
                    model_name='flux',
                    mode='image_to_image_edit',
                    source_image_url='https://example.com/ref.jpg',
                )

    def test_remix_missing_url_raises(self):
        from design_app.services.image_generator import generate_image
        with self._patch_settings():
            with pytest.raises(ValueError, match='source_image_url required'):
                generate_image(
                    prompt='Mix these',
                    model_name='gemini_flash',
                    mode='remix',
                )

    def test_remix_missing_url_2_raises(self):
        from design_app.services.image_generator import generate_image
        with self._patch_settings():
            with pytest.raises(ValueError, match='source_image_url_2 required'):
                generate_image(
                    prompt='Mix these',
                    model_name='gemini_flash',
                    mode='remix',
                    source_image_url='https://example.com/a.jpg',
                )

    def test_remix_non_multimodal_raises(self):
        from design_app.services.image_generator import generate_image
        with self._patch_settings():
            with pytest.raises(ValueError, match='does not support image input'):
                generate_image(
                    prompt='Mix these',
                    model_name='flux',
                    mode='remix',
                    source_image_url='https://example.com/a.jpg',
                    source_image_url_2='https://example.com/b.jpg',
                )


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

    # PROJ-9 routing tests (should_use_client, get_upscale_decision, upscale_api)
    # were removed in PROJ-27 along with the Pica.js / auto-threshold logic.
    # PROJ-27 upscaler tests live in test_upscaler_service.py.


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

    # PROJ-9 routing tests (mode=client/server via get_upscale_decision) were
    # removed in PROJ-27. The new flow always goes through Replicate via
    # enqueue_replicate_upscale; tests for that flow live in
    # test_upscale_callback_processing.py.


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


class TestSystemPromptAndBgColor:
    """PROJ-34 Phase 2: AC-1/AC-2/AC-7/AC-9 — system prompt always sent,
    bg-color hex injected from persisted UI selection."""

    @pytest.fixture(autouse=True)
    def _autouse_passthrough(self, _passthrough_data_url):
        yield

    def _ok_response(self, b64_data):
        return {
            'choices': [{
                'message': {
                    'content': [
                        {'inline_data': {'data': b64_data, 'mime_type': 'image/png'}},
                    ],
                },
            }],
        }

    def _stub_post(self, mock_client_cls):
        from io import BytesIO
        from PIL import Image as _PIL
        buf = BytesIO()
        _PIL.new('RGBA', (1, 1)).save(buf, 'PNG')
        b64_data = base64.b64encode(buf.getvalue()).decode()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = self._ok_response(b64_data)
        mock_resp.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.post.return_value = mock_resp
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client_cls.return_value = mock_client
        return mock_client

    @patch('design_app.services.image_generator.httpx.Client')
    def test_system_prompt_always_sent_text_only(self, mock_client_cls, tmp_path):
        """AC-2: every payload has the DESIGN_GEN_SYSTEM_PROMPT at messages[0]."""
        from design_app.services.image_generator import (
            DESIGN_GEN_SYSTEM_PROMPT, generate_image,
        )
        mock_client = self._stub_post(mock_client_cls)
        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
            generate_image(
                prompt='Just a plain prompt',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
            )
        payload = mock_client.post.call_args.kwargs['json']
        messages = payload['messages']
        assert len(messages) == 2
        assert messages[0]['role'] == 'system'
        assert messages[0]['content'] == DESIGN_GEN_SYSTEM_PROMPT
        assert messages[1]['role'] == 'user'
        # Without bg_color, the user prompt is unchanged.
        assert messages[1]['content'] == 'Just a plain prompt'

    @patch('design_app.services.image_generator.httpx.Client')
    def test_neon_pink_injects_hex_in_user_prompt(self, mock_client_cls, tmp_path):
        """AC-9: selecting neon_pink → #FF6EC7 appears in OpenRouter payload."""
        from design_app.services.image_generator import generate_image
        mock_client = self._stub_post(mock_client_cls)
        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
            generate_image(
                prompt='School bus driver design',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
                background_color='neon_pink',
            )
        payload = mock_client.post.call_args.kwargs['json']
        user_content = payload['messages'][1]['content']
        # Text-only user content with bg_color → string with appended bg line.
        assert isinstance(user_content, str)
        assert 'School bus driver design' in user_content
        assert '#FF6EC7' in user_content
        assert 'solid #FF6EC7' in user_content
        assert 'no gradients' in user_content

    @patch('design_app.services.image_generator.httpx.Client')
    def test_bg_color_appended_to_multimodal_text_part(self, mock_client_cls, tmp_path):
        """AC-7: bg-color appended even for multimodal (i2i / remix) payloads."""
        from design_app.services.image_generator import generate_image
        mock_client = self._stub_post(mock_client_cls)
        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
            generate_image(
                prompt='Make brighter',
                model_name='gemini_flash',
                output_dir=str(tmp_path),
                source_image_url='https://example.com/ref.jpg',
                mode='image_to_image',
                background_color='neon_green',
            )
        payload = mock_client.post.call_args.kwargs['json']
        user_content = payload['messages'][1]['content']
        assert isinstance(user_content, list)
        text_parts = [p['text'] for p in user_content if p.get('type') == 'text']
        assert any('#39FF14' in t for t in text_parts)
        assert any('Make brighter' in t for t in text_parts)

    def test_unknown_model_still_raises_with_new_map_shape(self):
        """Restructured MODEL_MAP must still raise on unknown model names."""
        from design_app.services.image_generator import generate_image
        with patch(
            'design_app.services.image_generator.settings',
        ) as mock_settings:
            mock_settings.OPENROUTER_API_KEY = 'test-key'
            mock_settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
            with pytest.raises(ValueError, match='Unknown model'):
                generate_image(
                    prompt='something',
                    model_name='no-such-model',
                )

    def test_build_content_appends_bg_color_to_plain_string(self):
        """Direct _build_content call with bg_color returns string with bg line."""
        from design_app.services.image_generator import _build_content
        result = _build_content(
            'text_to_image', 'Vector cat design',
            background_color='light_gray',
        )
        assert isinstance(result, str)
        assert 'Vector cat design' in result
        assert '#D3D3D3' in result

    def test_build_content_no_bg_color_unchanged(self):
        """_build_content without bg_color returns the prompt verbatim (back-compat)."""
        from design_app.services.image_generator import _build_content
        result = _build_content('text_to_image', 'Vector cat design')
        assert result == 'Vector cat design'

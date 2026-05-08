"""PROJ-27: tests for design_app.services.replicate_client wrapper."""

from unittest.mock import MagicMock, patch

import pytest

from design_app.services import replicate_client


@pytest.mark.unit
class TestStartPrediction:

    @patch.object(replicate_client, 'settings')
    def test_raises_when_token_missing(self, mock_settings):
        mock_settings.REPLICATE_API_TOKEN = ''
        with pytest.raises(replicate_client.ReplicateConfigError):
            replicate_client.start_prediction(
                image_url='https://example.com/x.png',
                scale=4,
                webhook_url='https://x/api/upscale/callback/',
                model_slug='nightmareai/real-esrgan',
            )

    def test_uses_version_when_provided(self, settings):
        settings.REPLICATE_API_TOKEN = 'test-token'
        fake_module = MagicMock()
        fake_module.predictions.create.return_value = MagicMock(
            id='pred-123', status='starting',
        )
        with patch.dict('sys.modules', {'replicate': fake_module}):
            out = replicate_client.start_prediction(
                image_url='https://example.com/x.png',
                scale=4,
                webhook_url='https://x/api/upscale/callback/',
                model_slug='nightmareai/real-esrgan',
                model_version='abc123',
            )
        kwargs = fake_module.predictions.create.call_args.kwargs
        assert kwargs['model'] == 'nightmareai/real-esrgan:abc123'
        assert kwargs['input']['image'] == 'https://example.com/x.png'
        assert kwargs['input']['scale'] == 4
        assert kwargs['input']['face_enhance'] is False
        assert kwargs['webhook_events_filter'] == ['completed']
        assert out['id'] == 'pred-123'

    def test_omits_version_when_blank(self, settings):
        settings.REPLICATE_API_TOKEN = 'test-token'
        fake_module = MagicMock()
        fake_module.predictions.create.return_value = MagicMock(
            id='pred-456', status='starting',
        )
        with patch.dict('sys.modules', {'replicate': fake_module}):
            replicate_client.start_prediction(
                image_url='https://example.com/x.png',
                scale=4,
                webhook_url='https://x/api/upscale/callback/',
                model_slug='nightmareai/real-esrgan',
            )
        kwargs = fake_module.predictions.create.call_args.kwargs
        assert kwargs['model'] == 'nightmareai/real-esrgan'


@pytest.mark.unit
class TestVerifyWebhookSignature:

    def test_raises_when_no_secrets_configured(self, settings):
        settings.REPLICATE_WEBHOOK_SECRET = ''
        settings.REPLICATE_WEBHOOK_SECRET_PREVIOUS = ''
        with pytest.raises(replicate_client.ReplicateConfigError):
            replicate_client.verify_webhook_signature(
                headers={'webhook-id': 'x'},
                body='{}',
            )

    def test_passes_with_valid_primary(self, settings):
        settings.REPLICATE_WEBHOOK_SECRET = 'whsec_primary'
        settings.REPLICATE_WEBHOOK_SECRET_PREVIOUS = ''
        with patch('design_app.services.replicate_client.replicate', create=True) as mock_replicate:
            with patch.object(
                replicate_client, 'WebhookSigningSecret', create=True,
                new=lambda key: f'wrapped:{key}',
            ):
                # We want patch.dict approach so the lazy `import replicate` in
                # the function picks up the mock.
                pass

        # Use sys.modules patching so the lazy import resolves to mocks.
        fake_replicate = MagicMock()
        fake_replicate.webhooks.validate.return_value = None
        fake_webhook_module = MagicMock()
        fake_webhook_module.WebhookSigningSecret = lambda key: f'wrapped:{key}'

        with patch.dict('sys.modules', {
            'replicate': fake_replicate,
            'replicate.webhook': fake_webhook_module,
        }):
            replicate_client.verify_webhook_signature(
                headers={'webhook-id': 'x'},
                body='{"id":"abc"}',
            )
        fake_replicate.webhooks.validate.assert_called_once()

    def test_falls_back_to_previous_on_failure(self, settings):
        settings.REPLICATE_WEBHOOK_SECRET = 'whsec_primary'
        settings.REPLICATE_WEBHOOK_SECRET_PREVIOUS = 'whsec_previous'
        fake_replicate = MagicMock()
        fake_replicate.webhooks.validate.side_effect = [Exception('bad'), None]
        fake_webhook_module = MagicMock()
        fake_webhook_module.WebhookSigningSecret = lambda key: f'wrapped:{key}'
        with patch.dict('sys.modules', {
            'replicate': fake_replicate,
            'replicate.webhook': fake_webhook_module,
        }):
            replicate_client.verify_webhook_signature(
                headers={'webhook-id': 'x'},
                body='{"id":"abc"}',
            )
        assert fake_replicate.webhooks.validate.call_count == 2

    def test_raises_when_both_fail(self, settings):
        settings.REPLICATE_WEBHOOK_SECRET = 'whsec_primary'
        settings.REPLICATE_WEBHOOK_SECRET_PREVIOUS = 'whsec_previous'
        fake_replicate = MagicMock()
        fake_replicate.webhooks.validate.side_effect = [Exception('a'), Exception('b')]
        fake_webhook_module = MagicMock()
        fake_webhook_module.WebhookSigningSecret = lambda key: f'wrapped:{key}'
        with patch.dict('sys.modules', {
            'replicate': fake_replicate,
            'replicate.webhook': fake_webhook_module,
        }):
            with pytest.raises(replicate_client.ReplicateSignatureError):
                replicate_client.verify_webhook_signature(
                    headers={'webhook-id': 'x'},
                    body='{"id":"abc"}',
                )


@pytest.mark.unit
class TestGetPrediction:

    def test_normalizes_list_output_to_first(self, settings):
        settings.REPLICATE_API_TOKEN = 'test-token'
        fake_module = MagicMock()
        fake_module.predictions.get.return_value = MagicMock(
            id='pred-1',
            status='succeeded',
            output=['https://r.com/a.png', 'https://r.com/b.png'],
            error=None,
        )
        with patch.dict('sys.modules', {'replicate': fake_module}):
            out = replicate_client.get_prediction('pred-1')
        assert out['output'] == 'https://r.com/a.png'
        assert out['status'] == 'succeeded'

    def test_keeps_string_output(self, settings):
        settings.REPLICATE_API_TOKEN = 'test-token'
        fake_module = MagicMock()
        fake_module.predictions.get.return_value = MagicMock(
            id='pred-1',
            status='succeeded',
            output='https://r.com/a.png',
            error=None,
        )
        with patch.dict('sys.modules', {'replicate': fake_module}):
            out = replicate_client.get_prediction('pred-1')
        assert out['output'] == 'https://r.com/a.png'

"""WebSocket consumer for Desktop Upload App communication.

Handles bidirectional communication:
- Server -> App: new upload jobs
- App -> Server: status updates (validating, uploading, completed, failed)
"""

import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)


class UploadAppConsumer(AsyncJsonWebsocketConsumer):
    """WebSocket consumer for Desktop Upload App."""

    async def connect(self):
        """Authenticate and join workspace group."""
        # Workspace ID from query string: ws://host/ws/upload-app/?workspace_id=...
        self.workspace_id = self.scope['url_route']['kwargs'].get('workspace_id', '')
        if not self.workspace_id:
            qs = self.scope.get('query_string', b'').decode()
            for param in qs.split('&'):
                if param.startswith('workspace_id='):
                    self.workspace_id = param.split('=', 1)[1]

        if not self.workspace_id:
            await self.close(code=4001)
            return

        self.group_name = f'upload_app_{self.workspace_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        logger.info("Desktop App connected for workspace %s", self.workspace_id)

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(
                self.group_name, self.channel_name,
            )
        logger.info("Desktop App disconnected for workspace %s", getattr(self, 'workspace_id', '?'))

    async def receive_json(self, content, **kwargs):
        """Handle status updates from Desktop App."""
        msg_type = content.get('type')

        if msg_type == 'status_update':
            job_id = content.get('job_id')
            new_status = content.get('status')
            asin = content.get('asin', '')
            error_message = content.get('error_message', '')
            error_screenshot = content.get('error_screenshot', '')

            await self._update_job_status(
                job_id, new_status, asin, error_message, error_screenshot,
            )

    @database_sync_to_async
    def _update_job_status(self, job_id, new_status, asin, error_message, error_screenshot):
        """Update UploadJob status from Desktop App."""
        from django.utils import timezone

        from publish_app.models import UploadJob
        from publish_app.services.lifecycle_tracker import create_or_update_lifecycle

        try:
            job = UploadJob.objects.get(pk=job_id, workspace_id=self.workspace_id)
        except UploadJob.DoesNotExist:
            logger.warning("Job %s not found in workspace %s", job_id, self.workspace_id)
            return

        now = timezone.now()
        job.status = new_status

        if new_status == 'uploading' and not job.started_at:
            job.started_at = now
        if new_status == 'completed':
            job.completed_at = now
            job.asin = asin
            job.upload_date = now
        if new_status == 'failed':
            job.error_message = error_message
            job.error_screenshot = error_screenshot
            job.retry_count += 1

        job.save()

        if new_status == 'completed' and asin:
            create_or_update_lifecycle(job)

    # Group message handler: push new jobs to Desktop App
    async def upload_job_new(self, event):
        """Send new job data to Desktop App."""
        await self.send_json(event['data'])

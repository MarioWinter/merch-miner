"""PROJ-20 Phase 7.2 — Chat-attachment upload + delete endpoints.

POST /api/chat/attachments/        — multipart upload (1..MAX files)
DELETE /api/chat/attachments/<id>/ — remove a not-yet-attached file
"""

import io
import logging
import uuid as uuid_pkg

import magic
from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from chat_attachments_app.constants import (
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    MAX_FILES_PER_REQUEST,
    MAX_TOTAL_SIZE_BYTES,
    RESIZE_MAX_DIMENSION,
)
from chat_attachments_app.models import ChatAttachment
from chat_attachments_app.api.serializers import ChatAttachmentSerializer
from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

logger = logging.getLogger(__name__)

# Pillow guard against decompression bomb attacks (EC-17). Pillow raises
# Image.DecompressionBombError when the pixel count exceeds MAX_IMAGE_PIXELS.
# We pin a conservative limit and let Pillow enforce it during open().
Image.MAX_IMAGE_PIXELS = 32_000_000  # ~32 MP


def _resolve_workspace(request):
    workspace_id = request.headers.get('X-Workspace-Id')
    if not workspace_id:
        return None, Response(
            {'error': 'X-Workspace-Id header is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    membership = (
        Membership.objects.filter(
            user=request.user,
            status=Membership.Status.ACTIVE,
            workspace_id=workspace_id,
        )
        .select_related('workspace')
        .first()
    )
    if not membership:
        return None, Response(
            {'error': 'No active workspace membership.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return membership.workspace, None


def _resize_to_webp(raw_bytes: bytes) -> tuple[bytes, str, str]:
    """Decode → resize (longest edge ≤ RESIZE_MAX_DIMENSION) → re-encode webp.

    Returns (resized_bytes, mime_type, filename_basename).
    Raises ValueError if Pillow can't open the buffer (incl. bomb guard).
    """
    try:
        with Image.open(io.BytesIO(raw_bytes)) as img:
            # `verify` doesn't load full pixels but it's not enough — we need
            # full decode for the resize step. open() already triggered the
            # MAX_IMAGE_PIXELS check; re-open after verify to load.
            img.load()
            # Convert palette/RGBA-without-alpha/Greyscale to RGBA for
            # consistent webp output. Webp supports RGBA.
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGBA' if 'A' in img.mode else 'RGB')

            longest = max(img.width, img.height)
            if longest > RESIZE_MAX_DIMENSION:
                ratio = RESIZE_MAX_DIMENSION / longest
                new_size = (int(img.width * ratio), int(img.height * ratio))
                img = img.resize(new_size, Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, format='WEBP', quality=85, method=4)
            data = buf.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise ValueError(str(exc)) from exc

    filename = f'{uuid_pkg.uuid4()}.resized.webp'
    return data, 'image/webp', filename


class ChatAttachmentListCreateView(APIView):
    """POST /api/chat/attachments/ — multipart upload.

    Validation:
      - Auth + workspace membership (X-Workspace-Id header)
      - 1..MAX_FILES_PER_REQUEST files keyed under `files`
      - Each file ≤ MAX_FILE_SIZE_BYTES
      - Total ≤ MAX_TOTAL_SIZE_BYTES
      - Mime via python-magic (NOT trusting the client header)
      - Pillow decompression-bomb guard (Image.MAX_IMAGE_PIXELS)

    Returns: list of `ChatAttachmentSerializer` payloads.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {'error': 'At least one file is required (field: `files`).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(files) > MAX_FILES_PER_REQUEST:
            return Response(
                {
                    'error': (
                        f'Too many files. Max {MAX_FILES_PER_REQUEST} per '
                        f'request, got {len(files)}.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_size = sum(f.size for f in files)
        if total_size > MAX_TOTAL_SIZE_BYTES:
            return Response(
                {
                    'error': (
                        f'Total upload too large: {total_size} bytes '
                        f'(max {MAX_TOTAL_SIZE_BYTES}).'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created: list[ChatAttachment] = []
        for upload in files:
            # Per-file size cap — return 413 (Payload Too Large) per AC.
            if upload.size > MAX_FILE_SIZE_BYTES:
                return Response(
                    {
                        'error': (
                            f'File `{upload.name}` exceeds {MAX_FILE_SIZE_BYTES} '
                            f'bytes ({upload.size}).'
                        ),
                    },
                    status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                )

            raw = upload.read()

            # Mime sniffing — sample first 4KB is plenty for image headers.
            sniffed = magic.from_buffer(raw[:4096], mime=True)
            if sniffed not in ALLOWED_MIME_TYPES:
                return Response(
                    {
                        'error': (
                            f'File `{upload.name}` has unsupported mime '
                            f'`{sniffed}`. Allowed: '
                            f'{sorted(ALLOWED_MIME_TYPES)}.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                resized_bytes, resized_mime, resized_name = _resize_to_webp(raw)
            except ValueError as exc:
                logger.warning(
                    'Rejecting upload `%s` from user=%s ws=%s: %s',
                    upload.name,
                    request.user.id,
                    workspace.id,
                    exc,
                )
                return Response(
                    {
                        'error': (
                            f'File `{upload.name}` could not be processed '
                            f'(invalid or too large image).'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            attachment = ChatAttachment.objects.create(
                workspace=workspace,
                uploaded_by=request.user,
                file=ContentFile(resized_bytes, name=resized_name),
                original_filename=upload.name,
                mime_type=resized_mime,
                size_bytes=len(resized_bytes),
                attachment_type=ChatAttachment.AttachmentType.IMAGE,
            )
            created.append(attachment)

        serializer = ChatAttachmentSerializer(created, many=True)
        return Response(
            {'attachments': serializer.data},
            status=status.HTTP_201_CREATED,
        )


class ChatAttachmentDestroyView(APIView):
    """DELETE /api/chat/attachments/<uuid:attachment_id>/

    Removes an attachment that has not yet been associated with a sent
    message. Cross-workspace deletes return 403.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, attachment_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            attachment = ChatAttachment.objects.get(id=attachment_id)
        except ChatAttachment.DoesNotExist:
            return Response(
                {'error': 'Attachment not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if attachment.workspace_id != workspace.id:
            return Response(
                {'error': 'Cross-workspace delete not allowed.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Hard-delete the file blob too, not just the row.
        if attachment.file:
            try:
                attachment.file.delete(save=False)
            except OSError:  # pragma: no cover
                logger.exception('Failed to delete file for %s', attachment_id)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

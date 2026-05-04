"""Cloud file import: Google Drive + OneDrive.

Downloads files from cloud storage and creates DesignAsset records.
Actual OAuth2 flows handled by frontend; this receives file IDs after auth.
"""

import logging

import httpx

logger = logging.getLogger(__name__)


def import_from_google_drive(file_id: str, access_token: str) -> dict:
    """Download file metadata + content from Google Drive.

    Args:
        file_id: Google Drive file ID.
        access_token: User's OAuth2 access token.

    Returns:
        Dict with file_name, content_bytes, mime_type, file_size.

    Raises:
        httpx.HTTPStatusError: On API failure.
    """
    # Get metadata
    meta_url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'fields': 'id,name,mimeType,size,imageMediaMetadata'}

    with httpx.Client(timeout=30) as client:
        meta_resp = client.get(meta_url, headers=headers, params=params)
        meta_resp.raise_for_status()
        metadata = meta_resp.json()

        # Download content
        dl_url = f"{meta_url}?alt=media"
        dl_resp = client.get(dl_url, headers=headers)
        dl_resp.raise_for_status()

    dimensions = {}
    img_meta = metadata.get('imageMediaMetadata', {})
    if img_meta:
        dimensions = {
            'width': img_meta.get('width', 0),
            'height': img_meta.get('height', 0),
        }

    return {
        'file_name': metadata.get('name', f'{file_id}.png'),
        'content_bytes': dl_resp.content,
        'mime_type': metadata.get('mimeType', 'image/png'),
        'file_size': int(metadata.get('size', len(dl_resp.content))),
        'dimensions': dimensions,
        'source_file_id': file_id,
    }


def import_from_onedrive(file_id: str, access_token: str) -> dict:
    """Download file metadata + content from OneDrive.

    Args:
        file_id: OneDrive item ID.
        access_token: User's OAuth2 access token.

    Returns:
        Dict with file_name, content_bytes, mime_type, file_size.

    Raises:
        httpx.HTTPStatusError: On API failure.
    """
    base_url = "https://graph.microsoft.com/v1.0"
    headers = {'Authorization': f'Bearer {access_token}'}

    with httpx.Client(timeout=30) as client:
        # Get metadata
        meta_resp = client.get(
            f"{base_url}/me/drive/items/{file_id}",
            headers=headers,
        )
        meta_resp.raise_for_status()
        metadata = meta_resp.json()

        # Download content
        dl_resp = client.get(
            f"{base_url}/me/drive/items/{file_id}/content",
            headers=headers,
            follow_redirects=True,
        )
        dl_resp.raise_for_status()

    image = metadata.get('image', {})
    dimensions = {}
    if image:
        dimensions = {
            'width': image.get('width', 0),
            'height': image.get('height', 0),
        }

    return {
        'file_name': metadata.get('name', f'{file_id}.png'),
        'content_bytes': dl_resp.content,
        'mime_type': metadata.get('file', {}).get('mimeType', 'image/png'),
        'file_size': metadata.get('size', len(dl_resp.content)),
        'dimensions': dimensions,
        'source_file_id': file_id,
    }

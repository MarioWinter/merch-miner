"""Image generation via OpenRouter API."""

import base64
import logging
import mimetypes
import os
import tempfile
from io import BytesIO

import httpx
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

# OpenRouter model mapping — DB/frontend value → real OpenRouter model ID.
# The "image-generation" suffix variants we historically used are NOT real
# OpenRouter IDs; translate them to the actual published IDs here.
MODEL_MAP = {
    # Legacy short names (kept for existing DB records)
    'gemini_flash': 'google/gemini-2.5-flash-image',
    'gemini_pro': 'google/gemini-3-pro-image-preview',
    'gpt_image': 'openai/gpt-image-1',
    'flux': 'black-forest-labs/flux-1.1-pro',
    # Gemini image-gen — DB values map to real OpenRouter IDs
    'google/gemini-3.1-flash-preview-image-generation': 'google/gemini-3.1-flash-image-preview',
    'google/gemini-3-pro-preview-image-generation': 'google/gemini-3-pro-image-preview',
    'google/gemini-2.5-flash-preview-image-generation': 'google/gemini-2.5-flash-image',
    # OpenAI + others — IDs already correct
    'openai/gpt-5-image': 'openai/gpt-5-image',
    'openai/gpt-5-image-mini': 'openai/gpt-5-image-mini',
    'black-forest-labs/flux-1.1-pro': 'black-forest-labs/flux-1.1-pro',
    'bytedance-seed/seedream-4.5': 'bytedance-seed/seedream-4.5',
}

# Aspect ratio → pixel dimensions
ASPECT_RATIO_DIMS = {
    '1:1': (1024, 1024),
    '4:3': (1365, 1024),
    '3:4': (1024, 1365),
    '16:9': (1820, 1024),
    '9:16': (1024, 1820),
    '3:2': (1536, 1024),
    '2:3': (1024, 1536),
}

# Models that are Gemini-family (use modalities param)
_GEMINI_MODELS = {
    'gemini_flash', 'gemini_pro',
    'google/gemini-3.1-flash-preview-image-generation',
    'google/gemini-3-pro-preview-image-generation',
    'google/gemini-2.5-flash-preview-image-generation',
}

# Models that are OpenAI-family (use size param)
_OPENAI_MODELS = {
    'gpt_image',
    'openai/gpt-5-image',
    'openai/gpt-5-image-mini',
}

# Models that support multimodal input (image + text)
MULTIMODAL_MODELS = {
    # Gemini models support vision natively
    'gemini_flash', 'gemini_pro',
    'google/gemini-3.1-flash-preview-image-generation',
    'google/gemini-3-pro-preview-image-generation',
    'google/gemini-2.5-flash-preview-image-generation',
    # OpenAI models support image input
    'gpt_image',
    'openai/gpt-5-image',
    'openai/gpt-5-image-mini',
}


def _to_data_url(url: str) -> str:
    """Fetch a URL and return a data:image/...;base64,... URI.

    OpenRouter (and downstream models like Gemini) sometimes refuses to fetch
    external image URLs — Wikipedia thumbnails, Amazon CDN entries, even our
    own MEDIA_URL when private. Sending the bytes inline as a data URL
    sidesteps that entire failure mode at the cost of bandwidth from our server.
    """
    # If already a data URL, pass through unchanged.
    if url.startswith('data:'):
        return url
    # Local MEDIA_URL — load directly from disk for speed + reliability.
    media_url = getattr(settings, 'MEDIA_URL', '/media/')
    media_root = getattr(settings, 'MEDIA_ROOT', None)
    # Normalize to path: strip scheme+host if present (e.g. http://localhost:5173/media/...).
    path_only = url
    for marker in ('://',):
        if marker in path_only:
            after_host = path_only.split('://', 1)[1]
            slash = after_host.find('/')
            path_only = after_host[slash:] if slash >= 0 else '/'
    if media_root and path_only.startswith(media_url):
        rel = path_only[len(media_url):]
        path = os.path.join(media_root, rel)
        if os.path.exists(path):
            with open(path, 'rb') as f:
                data = f.read()
            mime = mimetypes.guess_type(path)[0] or 'image/png'
            return f'data:{mime};base64,' + base64.b64encode(data).decode('ascii')
    # Fall back to HTTP fetch.
    with httpx.Client(timeout=20.0, follow_redirects=True) as client:
        resp = client.get(url, headers={'User-Agent': 'merch-miner/1.0'})
        resp.raise_for_status()
    mime = resp.headers.get('content-type', 'image/png').split(';')[0].strip() or 'image/png'
    if not mime.startswith('image/'):
        mime = 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(resp.content).decode('ascii')


def _build_content(
    mode: str,
    prompt: str,
    source_image_url: str = '',
    source_image_url_2: str = '',
):
    """Build OpenRouter message content array based on generation mode.

    Returns plain string for text_to_image (no image), or a multimodal
    content list for image-based modes. Source images are inlined as
    data URLs to avoid OpenRouter / Gemini failing to fetch them.
    """
    src1_data = _to_data_url(source_image_url) if source_image_url else ''
    src2_data = _to_data_url(source_image_url_2) if source_image_url_2 else ''

    if mode == 'image_to_image':
        # Prompt dominates — image is style/mood guide
        text = (
            "Use the reference image as a style and mood guide, but follow "
            "the prompt for content. Generate a new design based on this "
            "prompt:\n\n"
            f"{prompt}"
        )
        return [
            {'type': 'image_url', 'image_url': {'url': src1_data}},
            {'type': 'text', 'text': text},
        ]

    if mode == 'image_to_image_edit':
        # Image dominates — prompt only tweaks
        text = (
            "Stay very close to the reference image. Only apply the "
            "following minor modifications:\n\n"
            f"{prompt}"
        )
        return [
            {'type': 'image_url', 'image_url': {'url': src1_data}},
            {'type': 'text', 'text': text},
        ]

    if mode == 'remix':
        # Mix both images + prompt
        text = (
            "Create a new design inspired by both reference images. "
            "Blend the styles, elements, and mood from both images while "
            "following this prompt:\n\n"
            f"{prompt}"
        )
        return [
            {'type': 'image_url', 'image_url': {'url': src1_data}},
            {'type': 'image_url', 'image_url': {'url': src2_data}},
            {'type': 'text', 'text': text},
        ]

    # text_to_image — may have optional reference image
    if source_image_url:
        return [
            {'type': 'text', 'text': prompt},
            {'type': 'image_url', 'image_url': {'url': src1_data}},
        ]

    return prompt


def generate_image(
    prompt: str,
    model_name: str,
    output_dir: str = None,
    aspect_ratio: str = '1:1',
    source_image_url: str = '',
    source_image_url_2: str = '',
    mode: str = 'text_to_image',
) -> str:
    """Generate an image via OpenRouter and save to disk.

    Args:
        prompt: Generation prompt text
        model_name: Model choice value (legacy short name or full OpenRouter ID)
        output_dir: Directory to save output. Defaults to tempdir.
        aspect_ratio: Aspect ratio string like '1:1', '16:9', etc.
        source_image_url: Reference image URL for multimodal generation.
        source_image_url_2: Second reference image URL for remix mode.
        mode: Generation mode — text_to_image, image_to_image,
            image_to_image_edit, or remix.

    Returns:
        Path to saved image file.

    Raises:
        ValueError: If API key missing, model unknown, non-multimodal model
            with image mode, or missing required image URLs
        httpx.HTTPStatusError: On API error
    """
    api_key = settings.OPENROUTER_API_KEY
    base_url = settings.OPENROUTER_BASE_URL

    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    model_id = MODEL_MAP.get(model_name)
    if not model_id:
        raise ValueError(f"Unknown model: {model_name}")

    _IMAGE_MODES = {'image_to_image', 'image_to_image_edit', 'remix'}
    needs_image = mode in _IMAGE_MODES

    # Validate image requirements per mode
    if needs_image and not source_image_url:
        raise ValueError(f"source_image_url required for {mode} mode")
    if needs_image and model_name not in MULTIMODAL_MODELS:
        raise ValueError(
            "Model does not support image input. "
            "Select a multimodal model for image-based generation."
        )
    if mode == 'remix' and not source_image_url_2:
        raise ValueError("source_image_url_2 required for remix mode")

    # Validate multimodal support for text_to_image with optional reference
    if source_image_url and not needs_image and model_name not in MULTIMODAL_MODELS:
        raise ValueError("Model does not support image input")

    width, height = ASPECT_RATIO_DIMS.get(aspect_ratio, (1024, 1024))

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Design Generator',
    }

    # Build message content based on mode
    content = _build_content(mode, prompt, source_image_url, source_image_url_2)

    payload = {
        'model': model_id,
        'messages': [
            {
                'role': 'user',
                'content': content,
            },
        ],
    }

    # Model-specific params
    if model_name in _GEMINI_MODELS:
        payload['modalities'] = ['image', 'text']
    elif model_name in _OPENAI_MODELS:
        payload['size'] = f'{width}x{height}'
        payload['quality'] = 'high'
    else:
        # Flux, Seedream, etc.
        payload['width'] = width
        payload['height'] = height

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
        )
        if resp.status_code >= 400:
            logger.error(
                "OpenRouter API error %s: %s",
                resp.status_code, resp.text[:500],
            )
        resp.raise_for_status()

    data = resp.json()

    # Extract image from response — varies by model
    image_data = _extract_image(data, model_name)

    if not image_data:
        content_text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        raise ValueError(
            f"No image in response. Content policy refusal? Response: {content_text[:300]}"
        )

    # Save to file
    if output_dir is None:
        output_dir = tempfile.gettempdir()

    fd, output_path = tempfile.mkstemp(suffix='.png', dir=output_dir)
    os.close(fd)

    img = Image.open(BytesIO(image_data))
    img.save(output_path, 'PNG')

    logger.info("Generated image: %s (model=%s, ratio=%s)", output_path, model_name, aspect_ratio)
    return output_path


def _extract_image(response_data: dict, model_name: str) -> bytes | None:
    """Extract image bytes from OpenRouter response.

    Different models return images differently:
    - Gemini: base64 inline_data in parts
    - GPT Image: base64 in content
    - Flux: URL or base64
    """
    import base64

    choices = response_data.get('choices', [])
    if not choices:
        return None

    message = choices[0].get('message', {})
    content = message.get('content', '')

    # Case 0: message.images[] (Gemini Flash Image via OpenRouter)
    images = message.get('images', [])
    if isinstance(images, list):
        for img in images:
            if isinstance(img, dict):
                url = img.get('image_url', {}).get('url', '')
                if url.startswith('data:'):
                    b64 = url.split(',', 1)[1]
                    return base64.b64decode(b64)
                if url.startswith('http'):
                    with httpx.Client(timeout=30.0) as client:
                        img_resp = client.get(url)
                        img_resp.raise_for_status()
                        return img_resp.content

    # Case 1: content is a list of parts (Gemini style)
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict):
                # inline_data with base64
                inline = part.get('inline_data', {})
                if inline.get('data'):
                    return base64.b64decode(inline['data'])
                # image_url with base64
                img_url = part.get('image_url', {})
                url = img_url.get('url', '')
                if url.startswith('data:'):
                    b64 = url.split(',', 1)[1]
                    return base64.b64decode(b64)
        return None

    # Case 2: content is a string — check for base64 or URL
    if isinstance(content, str):
        # Check if the response has a URL we can download
        if content.startswith('http'):
            with httpx.Client(timeout=30.0) as client:
                img_resp = client.get(content)
                img_resp.raise_for_status()
                return img_resp.content

        # Try base64 decode
        try:
            return base64.b64decode(content)
        except Exception:
            pass

    # Case 3: Check for image in data field (some models)
    data_field = message.get('data', [])
    if isinstance(data_field, list):
        for item in data_field:
            if isinstance(item, dict) and item.get('b64_json'):
                return base64.b64decode(item['b64_json'])

    return None

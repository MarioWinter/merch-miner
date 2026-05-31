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

# PROJ-34 — Hard rules always-on system prompt. Sent as ``role: system``
# before the user message on every generate_image() call (AC-1, AC-2).
# Encodes the 9 Architect Critical Rules from docs/design-prompts/knowledge.md
# plus the design-only / no-mockup / no-person hard rules and tech-specs.
DESIGN_GEN_SYSTEM_PROMPT = (
    "You are a Print-on-Demand (POD) vector design generator producing artwork "
    "for Merch-by-Amazon T-shirt listings. Your only output is a print-ready "
    "isolated graphic — never a t-shirt mockup, never a model wearing the "
    "design, never a product photograph, never a scene with the design in "
    "context. The output is the design itself, isolated, on the requested "
    "background color.\n\n"
    "## Hard rules — never violate\n\n"
    "1. NEVER produce a t-shirt, hoodie, mug, sticker mockup, or any other "
    "product as the output. Output ONLY the printable design / artwork / "
    "graphic itself.\n"
    "2. NEVER include a person, body part, or model. The output is "
    "product-photo-free and human-free.\n"
    "3. NEVER include scene context (no rooms, no backgrounds beyond a solid "
    "color, no environments).\n"
    "4. ALWAYS render the design centered, with generous padding and breathing "
    "room around all elements — no edge-to-edge text or imagery.\n"
    "5. ALWAYS honor the background color specified at the end of the user "
    "prompt (look for \"Background: solid #HEX, ...\"). The output background "
    "MUST be that exact solid color, flat, no gradients.\n"
    "6. Text inside the design MUST be inside double quotes in the prompt; "
    "render it as a physical typographic element with material properties "
    "(matte vinyl, glossy plastisol ink, screenprint flat).\n"
    "7. Use color-object binding: when a color is named, bind it to a specific "
    "element (\"golden yellow bus body\", \"white hand-drawn marker font\") "
    "rather than describing colors in isolation.\n"
    "8. Maintain hard vector edges, no anti-aliasing softness, no JPEG noise, "
    "no film grain unless explicitly requested as part of a vintage/distressed "
    "style.\n"
    "9. The output is print-ready: high contrast, clean outlines, commercial "
    "vector art, screen print ready, hard edges, no unnecessary gradients, "
    "vector sharpness, 300 DPI quality.\n"
    "10. NEVER produce gradient fills, glowing effects, soft-edge shadows, "
    "drop shadows, or any blurred edge. Print on Demand requires hard edges "
    "and flat color regions even on round shapes — render rounded geometry "
    "with crisp outlined boundaries and flat fills.\n\n"
    "## Style adherence\n\n"
    "If the user prompt names a style (e.g. \"vintage retro\", \"kawaii chibi\", "
    "\"halftone print\"), the entire design adopts that style consistently — "
    "typography, color palette, line treatment, shading, and texture all match "
    "the named style.\n\n"
    "## Format reminder\n\n"
    "The user prompt ends with the background-color instruction. That line is "
    "NOT decorative — it is the exact color of the canvas behind the design."
)


# OpenRouter model mapping — DB/frontend value → {openrouter_id + per-model flags}.
# Restructured (PROJ-34 task 2.3 / Appendix B) from flat str→str dict to nested
# {db_value: {openrouter_id, supports_system_role, supports_seed}} so we can
# carry per-model capability flags. All current models support both flags
# (probed 2026-05-17); defaults are kept ``True`` so future models stay safe
# by default and have to opt out.
MODEL_MAP = {
    # Legacy short names (kept for existing DB records)
    'gemini_flash': {
        'openrouter_id': 'google/gemini-2.5-flash-image',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'gemini_pro': {
        'openrouter_id': 'google/gemini-3-pro-image-preview',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'gpt_image': {
        'openrouter_id': 'openai/gpt-image-1',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'flux': {
        'openrouter_id': 'black-forest-labs/flux-1.1-pro',
        'supports_system_role': True,
        'supports_seed': True,
    },
    # Gemini image-gen — DB values map to real OpenRouter IDs
    'google/gemini-3.1-flash-preview-image-generation': {
        'openrouter_id': 'google/gemini-3.1-flash-image-preview',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'google/gemini-3-pro-preview-image-generation': {
        'openrouter_id': 'google/gemini-3-pro-image-preview',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'google/gemini-2.5-flash-preview-image-generation': {
        'openrouter_id': 'google/gemini-2.5-flash-image',
        'supports_system_role': True,
        'supports_seed': True,
    },
    # OpenAI + others — IDs already correct
    'openai/gpt-5-image': {
        'openrouter_id': 'openai/gpt-5-image',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'openai/gpt-5-image-mini': {
        'openrouter_id': 'openai/gpt-5-image-mini',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'openai/gpt-5.4-image-2': {
        'openrouter_id': 'openai/gpt-5.4-image-2',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'black-forest-labs/flux-1.1-pro': {
        'openrouter_id': 'black-forest-labs/flux-1.1-pro',
        'supports_system_role': True,
        'supports_seed': True,
    },
    # FLUX.2 family — all support text + image input. Use width/height
    # param shape (Flux/Seedream branch in generate_image — line ~485).
    'black-forest-labs/flux.2-klein-4b': {
        'openrouter_id': 'black-forest-labs/flux.2-klein-4b',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'black-forest-labs/flux.2-max': {
        'openrouter_id': 'black-forest-labs/flux.2-max',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'black-forest-labs/flux.2-flex': {
        'openrouter_id': 'black-forest-labs/flux.2-flex',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'black-forest-labs/flux.2-pro': {
        'openrouter_id': 'black-forest-labs/flux.2-pro',
        'supports_system_role': True,
        'supports_seed': True,
    },
    'bytedance-seed/seedream-4.5': {
        'openrouter_id': 'bytedance-seed/seedream-4.5',
        'supports_system_role': True,
        'supports_seed': True,
    },
}


# Background-color hex map. Mirrors Design.BG_COLOR_HEX. Kept here to avoid an
# import cycle (image_generator is imported by services + tasks).
BG_COLOR_HEX = {
    'light_gray': '#D3D3D3',
    'neon_pink': '#FF6EC7',
    'neon_green': '#39FF14',
}


def _bg_color_instruction(background_color: str | None) -> str:
    """Render the trailing background-color instruction line (AC-7).

    Returns an empty string when no bg_color is provided so callers stay
    backwards-compatible (tests + direct calls without bg propagation).
    """
    if not background_color:
        return ''
    hex_value = BG_COLOR_HEX.get(background_color)
    if not hex_value:
        return ''
    return (
        f"Background: solid {hex_value}, saturated, no gradients, "
        "flat single color background"
    )


def _aspect_ratio_instruction(aspect_ratio: str | None, model_name: str) -> str:
    """Render the trailing aspect-ratio instruction line for Gemini models.

    Gemini's image-preview endpoint silently ignores ``width``/``height``/
    ``size`` parameters today — it only honors ``modalities``. To get the
    user's chosen aspect ratio to actually influence the output, we inject
    a plain-text directive into the user prompt instead. Inspired by the
    way ``_bg_color_instruction`` already appends a colour-targeting line.

    Returns empty string for non-Gemini models (they receive the ratio via
    real API params — ``size`` for OpenAI, ``width``/``height`` for
    Flux/Seedream) and for the 1:1 default (no need to spell out the
    obvious + keeps payloads byte-identical for legacy callers).
    """
    if not aspect_ratio or aspect_ratio == '1:1':
        return ''
    if model_name not in _GEMINI_MODELS:
        return ''
    dims = ASPECT_RATIO_DIMS.get(aspect_ratio)
    if not dims:
        return ''
    width, height = dims
    orientation = 'portrait' if height > width else (
        'landscape' if width > height else 'square'
    )
    return (
        f"Output aspect ratio: {aspect_ratio} {orientation}, target "
        f"dimensions {width}×{height} pixels. The generated image MUST "
        "fill the full canvas at this aspect ratio with no letterboxing."
    )

# Aspect ratio → pixel dimensions
ASPECT_RATIO_DIMS = {
    '1:1': (1024, 1024),
    '4:3': (1365, 1024),
    '3:4': (1024, 1365),
    '16:9': (1820, 1024),
    '9:16': (1024, 1820),
    '3:2': (1536, 1024),
    '2:3': (1024, 1536),
    # 5:6 portrait — exact ratio (1000/1200 = 5/6) AND multiple-of-8
    # (diffusion friendly). 4.5× upscale lands on Merch by Amazon shirt
    # print target exactly (4500×5400 at 300dpi = 15"×18").
    '5:6': (1000, 1200),
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
    'openai/gpt-5.4-image-2',
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
    'openai/gpt-5.4-image-2',
    # FLUX.2 family — all support text + image input (editing)
    'black-forest-labs/flux.2-klein-4b',
    'black-forest-labs/flux.2-max',
    'black-forest-labs/flux.2-flex',
    'black-forest-labs/flux.2-pro',
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
    background_color: str | None = None,
    aspect_ratio: str | None = None,
    model_name: str = '',
):
    """Build OpenRouter message content array based on generation mode.

    Returns plain string for text_to_image (no image), or a multimodal
    content list for image-based modes. Source images are inlined as
    data URLs to avoid OpenRouter / Gemini failing to fetch them.

    PROJ-34 AC-7: when ``background_color`` is provided, the
    ``Background: solid #HEX, ...`` instruction is appended as the final
    segment of the user message (or as a trailing text part for multimodal
    modes). Omitted when ``background_color`` is None/empty so existing
    callers (tests, legacy paths) keep their byte-for-byte payload shape.

    FIX-canvas-editor-bugs-and-image-gen Phase D bonus — Gemini models
    silently ignore ``width``/``height``/``size`` params (they only honor
    ``modalities``). To get the user's selected aspect ratio to actually
    influence Gemini's output we ALSO append a plain-text ratio directive
    after the bg-color line via ``_aspect_ratio_instruction``. The helper
    returns empty string for non-Gemini models (they receive real params)
    AND for the 1:1 default (no need to spell it out + preserves
    byte-identical payloads for legacy callers).
    """
    src1_data = _to_data_url(source_image_url) if source_image_url else ''
    src2_data = _to_data_url(source_image_url_2) if source_image_url_2 else ''

    bg_instruction = _bg_color_instruction(background_color)
    ar_instruction = _aspect_ratio_instruction(aspect_ratio, model_name)

    def _with_bg(text: str) -> str:
        # Renamed in spirit to `_with_trailers` — appends both bg-color and
        # aspect-ratio directives when present, in that order so the
        # bg-color line stays the explicit "look here" anchor the system
        # prompt references (PROJ-34 hard-rule #5).
        parts = [text]
        if bg_instruction:
            parts.append(bg_instruction)
        if ar_instruction:
            parts.append(ar_instruction)
        return '\n\n'.join(parts)

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
            {'type': 'text', 'text': _with_bg(text)},
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
            {'type': 'text', 'text': _with_bg(text)},
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
            {'type': 'text', 'text': _with_bg(text)},
        ]

    # text_to_image — may have optional reference image
    if source_image_url:
        return [
            {'type': 'text', 'text': _with_bg(prompt)},
            {'type': 'image_url', 'image_url': {'url': src1_data}},
        ]

    return _with_bg(prompt)


def _build_messages(content, supports_system_role: bool) -> list[dict]:
    """Wrap user ``content`` with the design-only system prompt.

    AC-2: always sent as ``role: system`` before the user message.
    AC-3: for any model that rejects system messages, the constant is
    prepended as a wrapper at the start of the user message instead.
    Today every model in ``MODEL_MAP`` supports system role, but the
    branch exists so a future opt-out is a one-flag change.
    """
    if supports_system_role:
        return [
            {'role': 'system', 'content': DESIGN_GEN_SYSTEM_PROMPT},
            {'role': 'user', 'content': content},
        ]

    # Fallback: prepend the system text into the user message.
    prefix = f"{DESIGN_GEN_SYSTEM_PROMPT}\n\n---\n\n"
    if isinstance(content, str):
        merged = prefix + content
    else:
        # Multimodal content list: inject a leading text part with the prefix.
        merged = [{'type': 'text', 'text': prefix}, *content]
    return [{'role': 'user', 'content': merged}]


# Very rough char budget warning. Gemini supports ~1M context so this is just
# a sanity check for grossly-oversized user prompts (EC-4).
_USER_PROMPT_WARN_CHARS = 200_000


def _warn_if_oversized(content) -> None:
    """Log a warning if the user-side content looks dangerously large (EC-4)."""
    if isinstance(content, str):
        size = len(content)
    elif isinstance(content, list):
        size = sum(
            len(part.get('text', '')) for part in content
            if isinstance(part, dict) and part.get('type') == 'text'
        )
    else:
        return
    if size > _USER_PROMPT_WARN_CHARS:
        logger.warning(
            'generate_image: user content unusually large (%s chars) — '
            'check for accidental concatenation.', size,
        )


def generate_image(
    prompt: str,
    model_name: str,
    output_dir: str = None,
    aspect_ratio: str = '1:1',
    source_image_url: str = '',
    source_image_url_2: str = '',
    mode: str = 'text_to_image',
    background_color: str | None = None,
    seed: int | None = None,
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
        background_color: One of ``light_gray`` / ``neon_pink`` /
            ``neon_green``. When provided, the corresponding hex value is
            injected as the final ``Background: solid #HEX, ...`` line of the
            user prompt (PROJ-34 AC-7). When ``None`` no injection happens
            so legacy callers keep their exact payload shape.
        seed: Deterministic-variation seed (PROJ-34 AC-39 / Appendix H).
            Forwarded to OpenRouter as the ``seed`` parameter when the model
            supports it (see ``MODEL_MAP[model].supports_seed``). ``None``
            disables seed injection so legacy callers stay byte-identical.

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

    model_entry = MODEL_MAP.get(model_name)
    if not model_entry:
        raise ValueError(f"Unknown model: {model_name}")
    model_id = model_entry['openrouter_id']
    supports_system_role = model_entry.get('supports_system_role', True)
    supports_seed = model_entry.get('supports_seed', False)

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

    # Build message content based on mode (AC-7: bg-color appended to user
    # msg + FIX phase-D bonus: aspect-ratio appended for Gemini models that
    # silently ignore the width/height/size API param).
    content = _build_content(
        mode, prompt, source_image_url, source_image_url_2, background_color,
        aspect_ratio=aspect_ratio, model_name=model_name,
    )

    # PROJ-34 AC-1 / AC-2 / AC-3: always send the design-only system prompt.
    # For models that don't accept ``role: system`` we prepend the prompt to
    # the user message instead (future-proofing — no current model needs this).
    messages = _build_messages(content, supports_system_role)

    payload = {
        'model': model_id,
        'messages': messages,
    }

    # PROJ-34 AC-39 / Appendix H — pass-through seed for deterministic
    # variation when the model supports it. All 5 current image models do
    # (probed 2026-05-17). The seed is bounded to 32-bit because OpenRouter
    # forwards it as an int and some providers reject larger values.
    if seed is not None and supports_seed:
        payload['seed'] = int(seed) & 0xFFFFFFFF

    # PROJ-34 AC-4 prep: the worker may want to log/diagnose context-window
    # overruns (EC-4). The system prompt is ~2.1KB which is trivial for
    # Gemini's huge context, but emit a warning if user-side content is
    # unexpectedly large so it shows up in Langfuse pre-truncation.
    _warn_if_oversized(content)

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

#!/usr/bin/env python
"""PROJ-34 Phase 13o-llm — LLM-rendered spatial thumbnails via OpenRouter.

Replaces the schematic-PNG approach (`generate_spatial_thumbnails.py`) for
selected layout ids with real flat-vector renderings produced by
`google/gemini-3.1-flash-image-preview`. Every thumbnail uses the SAME
content (mountain peak + circular sun + "MOUNTAIN HIGH" slogan) — only the
layout grammar changes — so the user can directly compare layouts side-by-
side in the spatial picker.

Run TEST mode (5 representative ids only):

    docker compose exec web python /app/scripts/generate_spatial_thumbnails_llm.py \\
        --test-ids vertical_stack badge_emblem flush_aligned_block \\
                   crossed_tools_intersection illustration_only_no_text

Run FULL (all 43):

    docker compose exec web python /app/scripts/generate_spatial_thumbnails_llm.py --all

Dry-run (prints prompts, no API calls, no files written):

    docker compose exec web python /app/scripts/generate_spatial_thumbnails_llm.py \\
        --test-ids vertical_stack --dry-run
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image

# ─── Django bootstrap ────────────────────────────────────────────────────
HERE = Path(__file__).resolve()
HOST_DJANGO_DIR = HERE.parents[1] / 'django-app'
CONTAINER_DJANGO_DIR = Path('/app')
if (HOST_DJANGO_DIR / 'core' / 'settings.py').exists():
    DJANGO_DIR = HOST_DJANGO_DIR
elif (CONTAINER_DJANGO_DIR / 'core' / 'settings.py').exists():
    DJANGO_DIR = CONTAINER_DJANGO_DIR
else:
    raise SystemExit('Cannot locate django-app/ (no core/settings.py found).')
sys.path.insert(0, str(DJANGO_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django  # noqa: E402

django.setup()  # noqa: E402

from django.conf import settings  # noqa: E402

from design_app.services.style_library import SPATIAL_OPTIONS  # noqa: E402

# ─── Constants ───────────────────────────────────────────────────────────
MODEL_ID = 'google/gemini-3.1-flash-image-preview'
CANVAS = 512
RATE_LIMIT_SECONDS = 2.0

# Default output: frontend public dir (overwrites existing schematics).
DEFAULT_OUTPUT_DIR = (
    HERE.parents[1] / 'frontend-ui' / 'public' / 'spatial-thumbnails'
)

# Ids that drop the slogan (illustration-only).
ILLUSTRATION_ONLY_IDS = {'illustration_only_no_text'}
# Ids that drop the illustration (text-only / pure typography).
TEXT_ONLY_IDS = {
    'flush_aligned_block',
    'full_canvas_word_block',
    'stacked_word_block',
    'knockout_text',
    'big_word_tiny_tag',
    'word_as_shape',
    'pyramid_stack',
}


def _build_prompt(spatial_id: str, prompt_text: str) -> str:
    """Build the per-layout OpenRouter user prompt.

    Subject + slogan stay consistent across all 43 thumbnails so the user
    can compare layouts side-by-side in the picker grid. Only the LAYOUT
    grammar changes per call.

    Three branches:
    - illustration_only_no_text → strip slogan line, add "no text" hint.
    - text-only layouts → strip illustration line, use stacked slogan lines.
    - default → cool cat with sunglasses + slogan.
    """
    head = (
        f"A polished commercial Print-on-Demand t-shirt design with playful "
        f"character on a cream off-white #F5F2EB background.\n\n"
        f"CONTENT (consistent across all thumbnails):\n"
    )
    if spatial_id in ILLUSTRATION_ONLY_IDS:
        content = (
            "- A confident hand-illustrated pizza slice with visible "
            "toppings (pepperoni circles, basil leaves, melted cheese "
            "strings), drawn in black ink line-art with solid tomato-red "
            "(#D14B3E) accent fills on the pepperoni and tomato sauce.\n"
            "- NO text, NO slogan visible anywhere in the design."
        )
    elif spatial_id in TEXT_ONLY_IDS:
        content = (
            "- NO illustration — pure typography only. Use the slogan "
            "\"PIZZA TIME / SLICE OF LIFE / EVERY DAY\" as three stacked "
            "lines arranged according to the layout grammar below. Black "
            "ink with a single tomato-red (#D14B3E) accent word for "
            "emphasis."
        )
    else:
        content = (
            "- A confident hand-illustrated pizza slice with visible "
            "toppings (pepperoni circles, basil leaves, melted cheese "
            "strings), drawn in black ink line-art with solid tomato-red "
            "(#D14B3E) accent fills on the pepperoni and tomato sauce — "
            "recognizable, characterful, not abstract.\n"
            "- Slogan text: \"PIZZA TIME\" rendered in heavyweight display "
            "type with one accent word optionally in tomato-red."
        )

    layout_block = (
        f"\n\nLAYOUT (this is what changes per thumbnail):\n{prompt_text}\n\n"
        "PIZZA-THEME SUBSTITUTION RULE: whenever the LAYOUT above references "
        "generic objects, tools, or implements (e.g. 'axes', 'hammers', "
        "'arrows', 'paddles', 'tools', 'crossed objects', 'crossed "
        "implements', 'flanking motifs', 'decorative laurel leaves', "
        "'illustrated objects'), substitute pizza-themed equivalents "
        "instead: crossed pizza cutters (round wheel blade on a handle), "
        "kitchen chef knives, rolling pins, whole pepperoni discs, basil "
        "sprigs, pizza slices, or wedges of cheese. The thumbnail content "
        "stays consistently pizza-themed across the entire 43-thumbnail "
        "set — NEVER render axes, hammers, mountain peaks, suns, or any "
        "non-pizza imagery."
    )

    style = (
        "\nSTYLE:\n"
        "- Hand-drawn ink-line aesthetic, polished real-design feel, "
        "fully composed (not schematic, not placeholder-looking).\n"
        "- 3-color palette ONLY: cream off-white background, black ink, "
        "tomato-red #D14B3E accent. NO other colors.\n"
        "- Hard edges, no gradients, no glow, no soft shadows, no drop "
        "shadows. Vector sharpness, screen-print ready.\n"
        "- Square 512x512 canvas.\n"
        "- This should look like a finished POD t-shirt design you would "
        "see for sale, not a layout schematic.\n\n"
        "The cat and slogan are arranged STRICTLY according to the layout "
        "above — the layout grammar is the WHOLE point of the variation."
    )

    return head + content + layout_block + style


def _extract_image_bytes(response_data: dict) -> bytes | None:
    """Pull PNG bytes out of an OpenRouter Gemini-image response.

    Mirrors the message.images[] + content-list + content-string fallback
    chain in design_app.services.image_generator._extract_image but limited
    to what Gemini Flash Image actually returns (base64 data URLs).
    """
    choices = response_data.get('choices', [])
    if not choices:
        return None
    message = choices[0].get('message', {})

    # Primary path for Gemini via OpenRouter — message.images[].
    images = message.get('images', [])
    if isinstance(images, list):
        for img in images:
            if isinstance(img, dict):
                url = img.get('image_url', {}).get('url', '')
                if url.startswith('data:'):
                    return base64.b64decode(url.split(',', 1)[1])
                if url.startswith('http'):
                    with httpx.Client(timeout=30.0) as client:
                        resp = client.get(url)
                        resp.raise_for_status()
                        return resp.content

    # Fallback: content list with inline_data parts.
    content = message.get('content', '')
    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict):
                inline = part.get('inline_data', {})
                if inline.get('data'):
                    return base64.b64decode(inline['data'])
                img_url = part.get('image_url', {})
                url = img_url.get('url', '')
                if url.startswith('data:'):
                    return base64.b64decode(url.split(',', 1)[1])

    return None


def _call_openrouter(prompt: str) -> bytes:
    """Single OpenRouter call → raw PNG bytes.

    No system prompt — the production "design-only" system prompt forbids
    things (scene context, etc.) that aren't relevant to schematic-style
    layout placeholders. We send a clean user-only message instead.
    """
    api_key = settings.OPENROUTER_API_KEY
    base_url = settings.OPENROUTER_BASE_URL
    if not api_key:
        raise SystemExit('OPENROUTER_API_KEY not configured in settings.')

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Spatial Thumbnail Generator',
    }
    payload = {
        'model': MODEL_ID,
        'messages': [{'role': 'user', 'content': prompt}],
        'modalities': ['image', 'text'],
    }

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            f'{base_url}/chat/completions', headers=headers, json=payload,
        )
        if resp.status_code >= 400:
            raise SystemExit(
                f'OpenRouter API error {resp.status_code}: {resp.text[:500]}'
            )
        data = resp.json()

    image_bytes = _extract_image_bytes(data)
    if not image_bytes:
        snippet = str(data.get('choices', [{}])[0].get('message', {}))[:300]
        raise SystemExit(f'No image in response. Snippet: {snippet}')
    return image_bytes


def _save_png(image_bytes: bytes, out_path: Path) -> int:
    """Resize to 512×512 and save as PNG. Returns final file size."""
    img = Image.open(BytesIO(image_bytes))
    if img.size != (CANVAS, CANVAS):
        img = img.resize((CANVAS, CANVAS), Image.LANCZOS)
    if img.mode not in ('RGB', 'RGBA'):
        img = img.convert('RGB')
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format='PNG', optimize=True)
    return out_path.stat().st_size


def _resolve_targets(args) -> list[dict]:
    """Pick the SPATIAL_OPTIONS entries we'll render."""
    by_id = {e['id']: e for e in SPATIAL_OPTIONS}
    if args.all:
        return list(SPATIAL_OPTIONS)
    if not args.test_ids:
        raise SystemExit('Pass --test-ids <id> [<id> ...] or --all.')
    targets = []
    for sid in args.test_ids:
        if sid not in by_id:
            raise SystemExit(f'Unknown spatial id: {sid!r}')
        targets.append(by_id[sid])
    return targets


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--test-ids', nargs='+', default=None,
        help='Specific SPATIAL_OPTIONS ids to render.',
    )
    parser.add_argument(
        '--all', action='store_true',
        help='Render every SPATIAL_OPTIONS entry (43 calls).',
    )
    parser.add_argument(
        '--output-dir', default=str(DEFAULT_OUTPUT_DIR),
        help=f'Output directory. Default: {DEFAULT_OUTPUT_DIR}',
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Print resolved prompts without calling OpenRouter.',
    )
    args = parser.parse_args()

    targets = _resolve_targets(args)
    out_dir = Path(args.output_dir)

    print(f'Rendering {len(targets)} thumbnails -> {out_dir}')
    print(f'Model: {MODEL_ID}')
    print(f'Mode: {"DRY-RUN" if args.dry_run else "LIVE"}\n')

    for i, entry in enumerate(targets):
        spatial_id = entry['id']
        prompt = _build_prompt(spatial_id, entry['prompt_text'])
        print(f'[{i + 1}/{len(targets)}] {spatial_id}')

        if args.dry_run:
            print('--- PROMPT ---')
            print(prompt)
            print('--- END ---\n')
            continue

        image_bytes = _call_openrouter(prompt)
        out_path = out_dir / f'{spatial_id}.png'
        size = _save_png(image_bytes, out_path)
        print(f'  wrote {out_path.name} ({size:,} bytes)')

        if i < len(targets) - 1:
            time.sleep(RATE_LIMIT_SECONDS)

    print(f'\nDone. {len(targets)} thumbnail(s) processed.')


if __name__ == '__main__':
    main()

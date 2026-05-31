"""
Roadmap loader — parses ``docs/roadmap_user_facing.md`` (YAML front-matter).

The file is hand-curated by Mario and lives at repo root (one level above
Django ``BASE_DIR``). Defensive parsing: missing file or malformed YAML
returns an empty list and logs a warning — never raises.

Result is memoised in-process keyed by file mtime so repeated calls within
a single request do not re-read disk.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml
from django.conf import settings

logger = logging.getLogger(__name__)


_ROADMAP_FILENAME = 'roadmap_user_facing.md'
_FRONT_MATTER_FENCE = '---'

# Module-level memo: keyed by (path, mtime_ns, lang). Reset when file changes.
_memo: dict[tuple[str, int, str], list[dict]] = {}


_CONTAINER_STATIC_DIR = Path('/srv/static_content')


def _roadmap_path() -> Path:
    """Return the absolute path to ``roadmap_user_facing.md``.

    Resolution order:
      1. ``/srv/static_content/roadmap_user_facing.md`` — Docker bind-
         mount target (dev override + prod compose both mount the repo-
         root file here; mounting outside ``/app`` avoids the macOS
         virtiofs limitation that prevents nesting single-file mounts
         inside an existing dir bind-mount).
      2. ``BASE_DIR.parent / 'docs' / <file>`` — local pytest outside
         Docker (BASE_DIR == ``django-app/``; file lives at repo root).

    Returns the first existing candidate; otherwise the container path
    so the caller's downstream missing-file branch fires as expected.
    """
    container_path = _CONTAINER_STATIC_DIR / _ROADMAP_FILENAME
    if container_path.exists():
        return container_path
    return Path(settings.BASE_DIR).parent / 'docs' / _ROADMAP_FILENAME


def _parse_front_matter(text: str) -> dict:
    """
    Extract YAML front-matter from a Markdown file.

    Returns parsed dict, or empty dict if no front-matter / malformed.
    """
    stripped = text.lstrip()
    if not stripped.startswith(_FRONT_MATTER_FENCE):
        return {}

    # Split on fence lines: first chunk is YAML, rest is markdown body.
    parts = stripped.split(_FRONT_MATTER_FENCE, 2)
    # parts[0] is empty (before first ---), parts[1] is the YAML.
    if len(parts) < 3:
        return {}

    yaml_block = parts[1]
    try:
        loaded = yaml.safe_load(yaml_block)
    except yaml.YAMLError as exc:
        logger.warning('Roadmap front-matter YAML malformed: %s', exc)
        return {}

    return loaded if isinstance(loaded, dict) else {}


def _validate_items(raw_items, lang: str = 'de') -> list[dict]:
    """
    Filter the raw front-matter ``items`` list to dicts with required fields.

    Drops items missing ``title`` or ``description`` (logged as warning).

    ``lang`` selects the language-specific fields when present:
      * ``'en'`` → prefer ``title_en`` / ``description_en``; fall back to
        ``title`` / ``description`` so legacy single-language entries
        still render.
      * any other value → use ``title`` / ``description`` (German default).
    """
    if not isinstance(raw_items, list):
        return []

    valid: list[dict] = []
    for idx, item in enumerate(raw_items):
        if not isinstance(item, dict):
            logger.warning('Roadmap item %d is not a mapping; skipping', idx)
            continue
        if lang == 'en':
            title = item.get('title_en') or item.get('title')
            description = item.get('description_en') or item.get('description')
        else:
            title = item.get('title')
            description = item.get('description')
        if not title or not description:
            logger.warning(
                'Roadmap item %d missing required field (title/description); skipping',
                idx,
            )
            continue
        cleaned: dict = {
            'title': str(title),
            'description': str(description),
        }
        priority = item.get('priority')
        if priority is not None:
            cleaned['priority'] = priority
        valid.append(cleaned)
    return valid


def load_roadmap(lang: str = 'de') -> list[dict]:
    """
    Load the user-facing roadmap items.

    Returns a list of ``{title, description, priority?}`` dicts in file order.
    Returns ``[]`` if the file is missing, malformed, or contains no valid items.
    Caches result by ``(file mtime, lang)`` so the English + German variants
    coexist in-process without thrashing each other.
    """
    path = _roadmap_path()
    try:
        mtime_ns = path.stat().st_mtime_ns
    except FileNotFoundError:
        logger.warning('Roadmap file not found at %s', path)
        return []
    except OSError as exc:
        logger.warning('Cannot stat roadmap file %s: %s', path, exc)
        return []

    cache_key = (str(path), mtime_ns, lang)
    cached = _memo.get(cache_key)
    if cached is not None:
        return cached

    try:
        text = path.read_text(encoding='utf-8')
    except OSError as exc:
        logger.warning('Cannot read roadmap file %s: %s', path, exc)
        return []

    front_matter = _parse_front_matter(text)
    items = _validate_items(front_matter.get('items'), lang=lang)

    # Drop stale entries (different mtime) before storing the fresh result,
    # but keep peer-language entries that share this mtime.
    for key in list(_memo.keys()):
        if key[:2] != cache_key[:2]:
            del _memo[key]
    _memo[cache_key] = items
    return items


def roadmap_last_modified() -> Optional[datetime]:
    """
    Return the mtime of ``docs/roadmap_user_facing.md`` as a UTC datetime.

    Returns ``None`` if the file is missing.
    """
    path = _roadmap_path()
    try:
        mtime = path.stat().st_mtime
    except (FileNotFoundError, OSError):
        return None
    return datetime.fromtimestamp(mtime, tz=timezone.utc)

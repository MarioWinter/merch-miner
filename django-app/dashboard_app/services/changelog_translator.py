"""
Changelog translator — reads ``CHANGELOG.md`` (release-please generated) and
returns the top-N version sections with each bullet translated into German
user-benefit copy via an LLM call (OpenRouter).

Pipeline:
1. ``load_changelog_versions`` parses the Markdown into structured dicts.
2. ``translate_lines_to_german`` batches ALL bullets across the top-N versions
   into a single LLM call (cheaper than per-version) and parses the numbered
   response back.
3. ``get_translated_changelog`` orchestrates: cache lookup -> translate on miss
   -> store with 6h TTL on success / 15min TTL on failure (so the next visitor
   has a chance to refresh without retry-looping every request).

Defensive: every IO/LLM error returns a placeholder; never raises to the caller.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

from django.conf import settings
from django.core.cache import cache
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)


_CHANGELOG_FILENAME = 'CHANGELOG.md'

# `## [0.7.1](url) (2026-05-31)` — captures version + date
_VERSION_HEADING_RE = re.compile(
    r'^##\s+\[([^\]]+)\]\([^)]+\)\s+\((\d{4}-\d{2}-\d{2})\)',
    re.MULTILINE,
)
# Bullet line: `* ...` (preserves nested commits, drops the `* ` prefix)
_BULLET_RE = re.compile(r'^\*\s+(.+?)\s*$', re.MULTILINE)
# Trailing `([abc1234](https://github.com/.../commit/...))` link to strip
_COMMIT_LINK_RE = re.compile(r'\s*\(\[[a-f0-9]+\]\(https?://[^)]+\)\)\s*$')
# Numbered list line in LLM output: `1. text` or `1) text`
_NUMBERED_LINE_RE = re.compile(r'^\s*\d+[.)]\s+(.+?)\s*$')

CACHE_KEY_PREFIX = 'changelog_user:v'
SUCCESS_TTL_SECONDS = 60 * 60 * 6  # 6 hours per AC-4-4
FAILURE_TTL_SECONDS = 60 * 15      # 15 minutes — short retry window on failure

_PLACEHOLDER = 'Verbesserungen in dieser Version'

_SYSTEM_PROMPT = (
    'Du bist ein Produkt-Marketing-Texter für eine SaaS-App. '
    'Übersetze jedes technische Commit-Bullet in 1–2 Sätze in DEUTSCH, '
    'die den User-Benefit beschreiben — KEINE PROJ-IDs, KEINE Commit-SHAs, '
    'KEIN Tech-Jargon. Antwort als nummerierte Liste in derselben Reihenfolge.'
)


def _changelog_path() -> Path:
    """Absolute path to repo-root ``CHANGELOG.md`` (one level above BASE_DIR)."""
    return Path(settings.BASE_DIR).parent / _CHANGELOG_FILENAME


def _strip_commit_link(line: str) -> str:
    """Remove a trailing ``([sha](url))`` commit link from a bullet line."""
    return _COMMIT_LINK_RE.sub('', line).rstrip()


def load_changelog_versions(top_n: int = 3) -> list[dict]:
    """
    Parse ``CHANGELOG.md`` and return the top-N version sections.

    Each entry: ``{version: str, date: str, raw_lines: list[str]}``.
    ``raw_lines`` are bullet bodies WITHOUT the ``* `` prefix and WITHOUT the
    trailing ``([sha](url))`` link.

    Returns ``[]`` on missing file, malformed structure, or no versions found.
    """
    path = _changelog_path()
    try:
        text = path.read_text(encoding='utf-8')
    except FileNotFoundError:
        logger.warning('Changelog file not found at %s', path)
        return []
    except OSError as exc:
        logger.warning('Cannot read changelog file %s: %s', path, exc)
        return []

    matches = list(_VERSION_HEADING_RE.finditer(text))
    if not matches:
        logger.warning('Changelog has no parseable version headings')
        return []

    versions: list[dict] = []
    for i, match in enumerate(matches[:top_n]):
        version = match.group(1)
        date = match.group(2)
        body_start = match.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end]

        raw_lines: list[str] = []
        for bullet_match in _BULLET_RE.finditer(body):
            cleaned = _strip_commit_link(bullet_match.group(1))
            if cleaned:
                raw_lines.append(cleaned)

        versions.append({
            'version': version,
            'date': date,
            'raw_lines': raw_lines,
        })
    return versions


def _parse_numbered_response(text: str) -> list[str]:
    """Extract items from a numbered-list LLM response."""
    items: list[str] = []
    for line in text.splitlines():
        m = _NUMBERED_LINE_RE.match(line)
        if m:
            items.append(m.group(1).strip())
    return items


def translate_lines_to_german(
    lines: list[str], model_name: str,
) -> list[str]:
    """
    Translate a batch of commit-bullet lines into German user-benefit copy.

    Single LLM call regardless of input length. Returns one translated line
    per input line, in the same order. On error or count mismatch, returns
    ``[_PLACEHOLDER] * len(lines)`` and logs a warning.

    ``model_name`` is passed through to the embedded ChatOpenAI client (read
    from the caller's settings rather than re-reading inside).
    """
    if not lines:
        return []

    numbered_prompt = '\n'.join(f'{i + 1}. {line}' for i, line in enumerate(lines))
    try:
        llm = ChatOpenAI(
            model=model_name,
            temperature=0.4,
            base_url=settings.OPENROUTER_BASE_URL,
            api_key=settings.OPENROUTER_API_KEY,
            default_headers={
                'HTTP-Referer': settings.FRONTEND_URL,
                'X-OpenRouter-Title': settings.COMPANY_NAME,
            },
        )
        response = llm.invoke([
            {'role': 'system', 'content': _SYSTEM_PROMPT},
            {'role': 'user', 'content': numbered_prompt},
        ])
    except Exception as exc:
        logger.warning('Changelog LLM call failed: %s', exc)
        return [_PLACEHOLDER] * len(lines)

    content = getattr(response, 'content', '') or ''
    parsed = _parse_numbered_response(content)
    if len(parsed) != len(lines):
        logger.warning(
            'Changelog LLM returned %d items for %d inputs; using placeholders',
            len(parsed), len(lines),
        )
        return [_PLACEHOLDER] * len(lines)
    return parsed


def _cache_key_for(versions: list[dict]) -> Optional[str]:
    """Build the Redis cache key from the latest version string."""
    if not versions:
        return None
    return f'{CACHE_KEY_PREFIX}{versions[0]["version"]}'


def get_translated_changelog(top_n: int = 3) -> list[dict]:
    """
    Return top-N changelog versions with German user-benefit bullets.

    Result shape: ``[{version, date, items: [str, ...]}]``.

    Cache strategy:
    - Hit -> return cached list as-is.
    - Miss + LLM success -> store with 6h TTL.
    - Miss + LLM failure -> store placeholder with 15min TTL (short retry
      window — avoids per-request retry loop while still recovering soon).
    """
    versions = load_changelog_versions(top_n=top_n)
    if not versions:
        return []

    cache_key = _cache_key_for(versions)
    if cache_key is not None:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    # Flatten all bullets across versions for one batched LLM call.
    flat_lines: list[str] = []
    section_lengths: list[int] = []
    for v in versions:
        section_lengths.append(len(v['raw_lines']))
        flat_lines.extend(v['raw_lines'])

    if not flat_lines:
        result = [
            {'version': v['version'], 'date': v['date'], 'items': []}
            for v in versions
        ]
        if cache_key is not None:
            cache.set(cache_key, result, SUCCESS_TTL_SECONDS)
        return result

    translated = translate_lines_to_german(
        flat_lines, settings.CHANGELOG_TRANSLATE_MODEL,
    )
    is_failure = all(line == _PLACEHOLDER for line in translated)

    # Re-split per version using the original section lengths.
    result: list[dict] = []
    cursor = 0
    for v, length in zip(versions, section_lengths):
        chunk = translated[cursor:cursor + length]
        cursor += length
        result.append({
            'version': v['version'],
            'date': v['date'],
            'items': chunk,
        })

    if cache_key is not None:
        ttl = FAILURE_TTL_SECONDS if is_failure else SUCCESS_TTL_SECONDS
        cache.set(cache_key, result, ttl)
    return result

"""AI translation for listings via OpenRouter.

Translates listing fields to target languages while respecting MBA char limits.
"""

import json
import logging

from django.conf import settings
from langchain_openai import ChatOpenAI

from publish_app.services.listing_generator import CHAR_LIMITS

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    'en': 'English',
    'de': 'German',
    'fr': 'French',
    'it': 'Italian',
    'es': 'Spanish',
    'ja': 'Japanese',
}

SYSTEM_PROMPT = """You are an expert translator for Amazon product listings.
Translate the given MBA listing fields accurately while:
1. Preserving the marketing tone and emotional impact
2. Adapting idioms/cultural references for the target market
3. Staying within character limits

Return ONLY valid JSON with these exact keys:
{
  "title": "...",
  "bullet_1": "...",
  "bullet_2": "...",
  "bullet_3": "...",
  "bullet_4": "...",
  "bullet_5": "...",
  "description": "...",
  "backend_keywords": "...",
  "over_limit_fields": ["field1", "field2"]
}

Include "over_limit_fields" array listing any fields where the translation exceeds the character limit.
If all fields are within limits, return an empty array."""


def translate_listing(listing, target_language: str) -> dict:
    """Translate listing fields to target language.

    Args:
        listing: Listing model instance.
        target_language: ISO language code (e.g. 'de', 'fr').

    Returns:
        Dict with translated fields + over_limit_fields list.

    Raises:
        ValueError: If language not supported or parse fails.
    """
    lang_name = LANGUAGE_NAMES.get(target_language)
    if not lang_name:
        raise ValueError(f"Unsupported language: {target_language}")

    llm = ChatOpenAI(
        model='openai/gpt-4.1-mini',
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.3,
        default_headers={
            'HTTP-Referer': settings.FRONTEND_URL,
            'X-OpenRouter-Title': settings.COMPANY_NAME,
        },
    )

    source_fields = {
        'title': listing.title,
        'bullet_1': listing.bullet_1,
        'bullet_2': listing.bullet_2,
        'bullet_3': listing.bullet_3,
        'bullet_4': listing.bullet_4,
        'bullet_5': listing.bullet_5,
        'description': listing.description,
        'backend_keywords': listing.backend_keywords,
    }

    char_limits_str = '\n'.join(
        f"- {k}: {CHAR_LIMITS[k]} chars"
        for k in source_fields
        if k in CHAR_LIMITS
    )

    user_msg = (
        f"Translate to {lang_name}.\n\n"
        f"Character limits:\n{char_limits_str}\n\n"
        f"Source listing:\n{json.dumps(source_fields, ensure_ascii=False, indent=2)}"
    )

    response = llm.invoke([
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': user_msg},
    ])

    content = response.content.strip()
    result = _parse_json(content)
    if result is None:
        raise ValueError(f"Failed to parse translation response: {content[:200]}")

    # Check for over-limit fields
    over_limit = []
    for field, limit in CHAR_LIMITS.items():
        if field in result and field != 'brand_name':
            if len(result.get(field, '')) > limit:
                over_limit.append(field)

    result['over_limit_fields'] = over_limit
    return result


def _parse_json(content: str) -> dict | None:
    """Parse JSON from LLM response with fallback."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    start = content.find('{')
    end = content.rfind('}') + 1
    if start >= 0 and end > start:
        try:
            return json.loads(content[start:end])
        except json.JSONDecodeError:
            pass
    return None

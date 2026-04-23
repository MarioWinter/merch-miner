"""AI listing generation via OpenRouter.

Generates MBA-ready listing fields (brand, title, bullets, description, keywords)
from an idea's slogan text, optional design context, and extra keywords.
"""

import json
import logging

from django.conf import settings
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

# MBA character limits (AC-1: 5 bullets -> 2; keyword_context replaces
# backend_keywords as LLM-input hint).
CHAR_LIMITS = {
    'brand_name': 50,
    'title': 60,
    'bullet_1': 256,
    'bullet_2': 256,
    'description': 2000,
    'keyword_context': 500,
}

SYSTEM_PROMPT = """You are an expert Amazon Merch by Amazon (MBA) listing copywriter.
Generate a complete MBA listing optimized for search visibility and conversions.

STRICT CHARACTER LIMITS (NEVER EXCEED):
- Brand Name: 50 characters
- Title: 60 characters
- Bullet 1-2: 256 characters each
- Description: 2000 characters
- Keyword Context: 500 characters

RULES:
1. Title must include the main keyword/niche naturally
2. Each bullet should highlight a unique benefit or use case
3. Description should tell a story and include emotional hooks
4. keyword_context is AI-guidance only: comma-separated hints
5. Brand name should be catchy, memorable, and niche-relevant

Return ONLY valid JSON with these exact keys:
{
  "brand_name": "...",
  "title": "...",
  "bullet_1": "...",
  "bullet_2": "...",
  "description": "...",
  "keyword_context": "..."
}"""


def generate_listing(
    slogan_text: str,
    extra_keywords: str = '',
    language: str = 'en',
    design_context: str = '',
) -> dict:
    """Generate a complete MBA listing via LLM.

    Args:
        slogan_text: The idea/slogan to base the listing on.
        extra_keywords: Additional keywords to incorporate.
        language: Target language code (e.g. 'en', 'de').
        design_context: Optional design description for context.

    Returns:
        Dict with listing fields (brand_name, title, bullets, etc.)

    Raises:
        ValueError: If LLM response cannot be parsed.
    """
    llm = ChatOpenAI(
        model='openai/gpt-4.1-mini',
        api_key=settings.OPENROUTER_API_KEY,
        base_url=settings.OPENROUTER_BASE_URL,
        temperature=0.4,
        default_headers={
            'HTTP-Referer': settings.FRONTEND_URL,
            'X-OpenRouter-Title': settings.COMPANY_NAME,
        },
    )

    user_parts = [f"Slogan/Idea: {slogan_text}"]
    if extra_keywords:
        user_parts.append(f"Extra keywords to incorporate: {extra_keywords}")
    if design_context:
        user_parts.append(f"Design context: {design_context}")
    if language != 'en':
        user_parts.append(
            f"IMPORTANT: Write the listing in {language} language. "
            f"All fields must be in {language}."
        )

    user_msg = '\n'.join(user_parts)

    response = llm.invoke([
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': user_msg},
    ])

    content = response.content.strip()
    result = _parse_json(content)
    if result is None:
        raise ValueError(f"Failed to parse LLM listing response: {content[:200]}")

    # Enforce character limits
    for field, limit in CHAR_LIMITS.items():
        if field in result and len(result[field]) > limit:
            result[field] = result[field][:limit]

    return result


def _parse_json(content: str) -> dict | None:
    """Parse JSON from LLM response with fallback extraction."""
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

"""Gemini 3 Architect 7-step image analysis via OpenRouter."""

import json
import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Gemini 3 Architect, an expert visual analyst for print-on-demand T-shirt designs.

Analyze the provided product image in exactly 7 steps. Return ONLY valid JSON.

## 7-Step Analysis

1. **text_dna** — Extract all visible text. Note font style, size, weight, case, effects.
2. **visual** — Describe visual style (vintage, minimalist, bold, etc.), graphic elements, color palette.
3. **spatial** — Layout composition: where is text placed, alignment, spacing, hierarchy.
4. **style** — Overall aesthetic: retro, modern, grunge, clean, hand-drawn, etc.
5. **color** — Dominant colors (hex), background color, contrast level, saturation.
6. **tech** — Technical: estimated resolution, file type guess, transparency, print-readiness.
7. **final_prompt** — Synthesize steps 1-6 into a production-ready image generation prompt.

## 9 Critical Rules for Step 7 (Final Prompt)
1. NEVER mention "t-shirt" or "mockup" in the prompt — generate the DESIGN only
2. Include exact text from step 1 in quotes
3. Specify background color explicitly (will be injected by caller)
4. Include font style description from step 1
5. Include layout/composition from step 3
6. Include color palette from step 5
7. Keep prompt under 500 characters
8. Use comma-separated descriptors, not full sentences
9. End with "high quality, print resolution, isolated design"

## Output Format
```json
{
  "text_dna": {"text": "...", "font_style": "...", "effects": "..."},
  "visual": {"style": "...", "elements": "...", "palette": ["#hex", ...]},
  "spatial": {"layout": "...", "alignment": "...", "hierarchy": "..."},
  "style": {"aesthetic": "...", "mood": "..."},
  "color": {"dominant": ["#hex", ...], "background": "#hex", "contrast": "high/medium/low"},
  "tech": {"quality": "...", "transparency": true/false, "print_ready": true/false},
  "final_prompt": "..."
}
```"""


def analyze_image(image_url: str) -> dict:
    """Run 7-step analysis on an image URL via OpenRouter.

    Returns structured dict with 7 keys, or raises on failure.
    """
    api_key = settings.OPENROUTER_API_KEY
    base_url = settings.OPENROUTER_BASE_URL

    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Design Analyzer',
    }

    payload = {
        'model': 'google/gemini-2.5-flash-preview',
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': 'Analyze this product image using the 7-step framework.',
                    },
                    {
                        'type': 'image_url',
                        'image_url': {'url': image_url},
                    },
                ],
            },
        ],
        'temperature': 0.2,
        'max_tokens': 2000,
        'response_format': {'type': 'json_object'},
    }

    with httpx.Client(timeout=60.0) as client:
        resp = client.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()

    data = resp.json()
    content = data['choices'][0]['message']['content']

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        # Try to extract JSON from surrounding text
        start = content.find('{')
        end = content.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(content[start:end])
        logger.error("Failed to parse image analysis response: %s", content[:500])
        raise ValueError("Malformed analysis output from LLM")

"""Gemini 3 Architect 7-step image analysis via OpenRouter."""

import json
import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_langfuse():
    """Return Langfuse client if configured, else None."""
    if not getattr(settings, 'LANGFUSE_PUBLIC_KEY', '') or not getattr(
        settings, 'LANGFUSE_SECRET_KEY', '',
    ):
        return None
    try:
        from langfuse import Langfuse

        return Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )
    except ImportError:
        logger.warning("langfuse package not installed, skipping tracing")
        return None

# PROJ-34 AC-10: SYSTEM_PROMPT replaced 1:1 with the full Gemini 3 Architect
# framework from docs/design-prompts/knowledge.md (9 critical rules + 7-step
# analysis + mandatory final-prompt template + worked example).
# AC-11: JSON output schema kept identical — text_dna / visual / spatial /
# style / color / tech / final_prompt — so build_from_analysis and the
# "Use as Prompt" frontend button keep working without code changes.
SYSTEM_PROMPT = """# Role
You are the "Gemini 3 Architect", an elite design analyst and prompt engineer specialized in Print-on-Demand (POD) vector graphics. Your goal is to reverse-engineer input images into high-precision text-to-image prompts optimized specifically for the Google Gemini 3 (Nano Banana Pro) model.

# Objective
Analyze the provided input image step by step (reasoning) and generate a structured 7-step analysis ending with a highly optimized generation prompt. Observe the 9 critical rules. My career depends on it.

# Critical Rules
1. **Text Container:** Text MUST be inside double quotes `"LIKE THIS"`. Never use single quotes.
2. **Physicality:** Text is a physical object. You must describe its material (e.g., "matte vinyl", "glossy plastisol ink").
3. **No Mockups:** NEVER use the word "T-Shirt" in the final prompt. Use "Vector Print Design" or "Digital Sticker Art".
4. **Visual Font Description:** Do not just name a font. You MUST use 4+ adjectives describing geometry, weight, and edge style (e.g., "massive, heavyweight, slightly irregular cartoon-block font with rounded corners").
5. **Spatial Anchoring:** You MUST describe the layout exactly as seen. (e.g., "Text arched OVER the illustration").
6. **Text Segmentation:** Split descriptions for mixed fonts. (Example: 'The top text "HELLO" is [Style A], while the bottom text "WORLD" is [Style B]').
7. **Color-Object Binding:** Bind colors to objects. (e.g., "Golden yellow bus body", "white, thin handwritten marker font").
8. **Deep Visuals:** The illustration description must cover specific component details to ensure accuracy.
9. **Breathing Room:** Regardless of layout, you must instruct the prompt to maintain "generous padding" and separation between text and illustration to avoid overcrowding.

# Analysis Process

## Step 1: Text DNA Analysis (Source for [DETAILED TEXT DESCRIPTION] & [ADJECTIVES])
- **Exact Syntax:** Extract text string.
- **Word Count:** [Count].
- **Typography Adjectives:** Deep dive into shape (geometric vs. organic), weight (hairline vs. black), and edge style. **Crucial:** Identify imperfections (wobbly lines) and internal details (shine, gloss dots).
- **Text Segmentation:** Define exactly which text is where (Top/Bottom/Side).

## Step 2: Deep Visual Analysis (Source for [DEEP VISUAL DESCRIPTION])
- **Visual Description:** List at least 6 distinct physical features of the subject.
- **Art Style:** Define line consistency and shading.
- **Colors:** Bind colors to parts.

## Step 3: Spatial Layout & Composition (Source for [SPATIAL CONFIGURATION] & [ACCESSORIES])
- **Spatial Configuration:** Define the exact relationship between text and image (e.g., Vertical Stack, Horizontal Row, Badge). Where exactly is the text relative to the Illustration?
- **Accessories:** Where are the secondary elements positioned, such as decorations or dividers?

## Step 4: Deep Style Cohesion (Source for [STYLE DNA] & [MATERIAL/TEXTURE])
- **Style DNA (Vibe/Line/Shading):** Define the cultural aesthetic, line consistency (monoline etc.), and shading technique.
- **Material/Texture:** Describe the surface finish.

## Step 5: Deep Color Strategy & Roles
- **Primary Color:** Identify the main fill color used for the subject and text.
- **Contrast/Outline:** Identify the color used for definitions and borders.
- **Accent/Highlight:** Identify the color used for lighting or glare.
- **Background:** Set to the requested background color (will be supplied by caller).

## Step 6: Production & Technical Specifications (Source for [TECH SPECS])
- **Tech Specs:** Use keywords for Vector Fidelity ("Sharp vector curves"), Edge Quality ("Hard edges"), and print readiness ("Screen print ready", "300 DPI").
- **Forbidden Elements:** Explicitly note what to avoid (e.g., "No dithering", "No gradients").

## Step 7: The Final Prompt
Construct the final prompt using the mandatory template below. Ensure the bracketed placeholders are filled with the exact data defined in Steps 1-6.

**Template:**
"A professional Vector Print Design isolated on a [BACKGROUNDCOLOR] background. [INSERT SPATIAL CONFIGURATION: Describe exactly where the text is placed relative to the illustration. Explicitly request 'generous padding' and 'breathing room' between these elements]. The illustration features [INSERT DEEP VISUAL DESCRIPTION: Include perspective, line weight, and at least 6 specific details from Step 2]. The typography is integrated into the layout: [INSERT DETAILED TEXT DESCRIPTION: Segment the text by position (e.g., 'Top text reads...', 'Side text reads...') and describe specific colors]. The text is rendered in a 'massive, heavyweight, [INSERT ADJECTIVES describing irregularity, roundedness, and internal shine/gloss details from Step 1]' font style. The design features [INSERT ACCESSORIES]. The graphics are made of [INSERT MATERIAL/TEXTURE from Step 4]. High contrast, clean outlines, commercial vector art. [INSERT TECH SPECS: Mention 'screen print ready', 'hard edges', 'no gradients/noise', and 'vector sharpness']. [INSERT STYLE DNA: Describe the shading technique, line consistency, and the exact cultural vibe]."

# Worked Example (target density for `final_prompt`)
"A professional Vector Print Design isolated on a black background. A dense vertical typographic stack layout where the text is distributed above and below a central illustration. Explicitly maintain generous padding and breathing room between the text lines and the graphic to prevent overcrowding despite the high word count. The center features the signature cute, simplified cartoon school bus in a 3/4 view facing right, boasting a curved yellow roof, horizontal grille slats on the front, rounded wheel arches, a dark grey bumper, and square windows filled with pure white. The typography is integrated into a structured hierarchy: The Top Text Block reads \\"WHO THINKS\\" / \\"SCHOOL BUS\\" / \\"DRIVING IS EXHAUSTING?\\". The Bottom Text Block reads \\"LOOK AT ME\\" / \\"I FEEL GREAT!\\". The yellow text (\\"SCHOOL BUS\\" and \\"I FEEL GREAT!\\") is rendered in the specific 'massive, heavyweight, slightly irregular cartoon-block font with sharp corners and internal white gloss lines'. The white text uses the 'thin, casual hand-drawn marker' style. The design features white radiating motion burst lines surrounding the bus as accessories. The graphics are made with high contrast, clean outlines, commercial vector art. Screen print ready, hard edges, no gradients/noise, vector sharpness. Playful, flat vector style with consistent thick black outlines."

# Output Format
Return ONLY valid JSON. The schema below is fixed — downstream consumers depend on these exact keys:

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
```

The `final_prompt` field MUST follow the Step 7 template above — typically 600–1500 characters, dense with color-object binding, font-physicality adjectives, and explicit breathing-room language. Short or generic `final_prompt` strings indicate failure to follow the framework."""


def analyze_image(image_url: str) -> dict:
    """Run 7-step analysis on an image URL via OpenRouter.

    Returns structured dict with 7 keys, or raises on failure.
    Traces the LLM call via Langfuse when configured.
    """
    api_key = settings.OPENROUTER_API_KEY
    base_url = settings.OPENROUTER_BASE_URL

    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    model_name = 'google/gemini-2.5-flash-preview'

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Design Analyzer',
    }

    payload = {
        'model': model_name,
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

    # --- Langfuse tracing ---
    langfuse = _get_langfuse()
    trace = None
    generation = None
    if langfuse:
        try:
            trace = langfuse.trace(
                name="design-image-analysis",
                metadata={"image_url": image_url, "prompt_version": "v2-architect"},
                # PROJ-34 task 3.5: tag with v2 to enable pre/post quality
                # comparisons in Langfuse dashboards.
                tags=["design_app", "image_analysis", "architect-v2"],
            )
            generation = trace.generation(
                name="gemini-7-step-analysis",
                model=model_name,
                input=payload['messages'],
                model_parameters={
                    "temperature": 0.2,
                    "max_tokens": 2000,
                },
            )
        except Exception:
            logger.warning("Failed to init Langfuse trace for image analysis")
            trace = None
            generation = None

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                f'{base_url}/chat/completions',
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()

        data = resp.json()
        content = data['choices'][0]['message']['content']

        # Extract usage stats for Langfuse
        usage = data.get('usage', {})

        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # Try to extract JSON from surrounding text
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                result = json.loads(content[start:end])
            else:
                logger.error(
                    "Failed to parse image analysis response: %s", content[:500],
                )
                if generation:
                    generation.end(
                        output=content[:500],
                        level="ERROR",
                        status_message="Malformed JSON output",
                    )
                raise ValueError("Malformed analysis output from LLM")

        # Log success to Langfuse
        if generation:
            try:
                generation.end(
                    output=result,
                    usage={
                        "input": usage.get('prompt_tokens'),
                        "output": usage.get('completion_tokens'),
                        "total": usage.get('total_tokens'),
                    },
                )
            except Exception:
                logger.warning("Failed to end Langfuse generation span")

        return result

    except Exception as exc:
        # Log error to Langfuse
        if generation:
            try:
                generation.end(
                    level="ERROR",
                    status_message=str(exc)[:500],
                )
            except Exception:
                pass
        raise
    finally:
        if langfuse:
            try:
                langfuse.flush()
            except Exception:
                logger.warning("Failed to flush Langfuse client")

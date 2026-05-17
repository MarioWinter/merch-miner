"""Prompt construction for design generation.

Two paths:
- image-driven: from 7-step analysis output
- idea-driven: from Idea DB fields + NicheResearch analysis

PROJ-34 added a third path: `build_architect_prompt` constructs N×M
deterministic Builder prompts from (slogan, style, warp?, niche?, bg).
"""

import logging

from design_app.models import Design
from design_app.services.style_library import STYLE_LIBRARY, WARP_PHRASES

logger = logging.getLogger(__name__)


def _format_niche_block(research_data: dict | None) -> str:
    """PROJ-34 Appendix D — render the niche-context parenthetical block.

    Returns the empty string when no data is available so the caller can
    omit the placeholder entirely.
    """
    if not research_data:
        return ''
    bits: list[str] = []
    visual_styles = research_data.get('visual_styles') or []
    vibes = research_data.get('vibes') or []
    tones = research_data.get('tones') or []
    if visual_styles:
        bits.append(f'visual styles: {", ".join(visual_styles[:3])}')
    if vibes:
        bits.append(f'vibes: {", ".join(vibes[:3])}')
    if tones:
        bits.append(f'tones: {", ".join(tones[:3])}')
    if not bits:
        return ''
    return f'(Niche style cues — {"; ".join(bits)})'


def build_architect_prompt(
    slogan: str,
    style_slug: str,
    *,
    warp: str | None = None,
    niche_context: dict | None = None,
    background_color: str = 'light_gray',
) -> str:
    """PROJ-34 Appendix C — assemble one deterministic Builder prompt.

    Slogan is wrapped in double quotes per Architect Rule 1; style suffix
    + optional warp phrase + optional niche block are injected in fixed
    order. The background-color line is appended last so it mirrors what
    `image_generator._build_content` would have added anyway (and stays
    immediately visible in Langfuse traces).

    Output is typically 300–700 chars depending on style + niche; well
    under the 1500-char cap mentioned in task 5.3.
    """
    style = STYLE_LIBRARY.get(style_slug)
    if not style:
        # Defensive: unknown slug falls back to generic vector style.
        style = {
            'label': style_slug.replace('_', ' ').title(),
            'prompt_suffix': 'Commercial vector design',
        }

    warp_phrase = WARP_PHRASES.get(warp, '') if warp else ''
    niche_block = _format_niche_block(niche_context)
    bg_hex = Design.BG_COLOR_HEX.get(background_color, '#D3D3D3')

    pieces = [
        f'{style["label"]} t-shirt vector design centered on a {bg_hex} background.',
        f'The design features the slogan text "{slogan}" as the primary typographic element.',
        f'{style["prompt_suffix"]}.',
    ]
    if warp_phrase:
        pieces.append(warp_phrase)
    if niche_block:
        pieces.append(niche_block)
    pieces.append(
        'Layout: centered composition with generous padding and breathing room. '
        'High contrast, clean outlines, commercial vector art. Screen print '
        'ready, hard edges, vector sharpness, 300 DPI.'
    )
    return ' '.join(pieces)


def build_from_analysis(analysis: dict, background_color: str) -> str:
    """Build prompt from 7-step image analysis output.

    Uses the final_prompt from step 7, appends background color instruction.
    """
    final_prompt = analysis.get('final_prompt', '')

    if not final_prompt:
        # Fallback: construct from individual steps
        parts = []
        text_dna = analysis.get('text_dna', {})
        if text_dna.get('text'):
            parts.append(f'Text: "{text_dna["text"]}"')
        if text_dna.get('font_style'):
            parts.append(f'{text_dna["font_style"]} font')

        visual = analysis.get('visual', {})
        if visual.get('style'):
            parts.append(visual['style'])
        if visual.get('elements'):
            parts.append(visual['elements'])

        style = analysis.get('style', {})
        if style.get('aesthetic'):
            parts.append(f'{style["aesthetic"]} aesthetic')

        parts.append('high quality, print resolution, isolated design')
        final_prompt = ', '.join(parts)

    # Inject background color
    bg_hex = Design.BG_COLOR_HEX.get(background_color, '#D3D3D3')
    bg_instruction = (
        f"Background: solid {bg_hex} color, saturated, no gradients, "
        f"no patterns, flat single color background"
    )

    return f"{final_prompt}\n{bg_instruction}"


def build_from_idea(idea, background_color: str, reference_analyses=None) -> str:
    """Build prompt from Idea DB fields + optional niche research analyses.

    Args:
        idea: Idea model instance
        background_color: BackgroundColor choice value
        reference_analyses: list of dicts with vision/emotional analysis fields
    """
    parts = []

    # Core: slogan text
    if idea.slogan_text:
        parts.append(f'T-shirt design with text: "{idea.slogan_text}"')

    # From idea fields (if populated via PROJ-8)
    if hasattr(idea, 'emotional_archetype') and idea.emotional_archetype:
        parts.append(f'emotional tone: {idea.emotional_archetype}')

    # From reference analyses (vision + emotional from PROJ-6)
    if reference_analyses:
        styles = set()
        elements = set()
        vibes = set()
        for ref in reference_analyses[:3]:  # Top 3 references
            if ref.get('visual_style'):
                styles.add(ref['visual_style'])
            if ref.get('graphic_elements'):
                elements.add(ref['graphic_elements'])
            if ref.get('vibe'):
                vibe_val = ref['vibe']
                if isinstance(vibe_val, dict):
                    vibe_val = vibe_val.get('primary', '')
                if isinstance(vibe_val, str) and vibe_val:
                    vibes.add(vibe_val)
            if ref.get('tone'):
                parts.append(f'tone: {ref["tone"]}')

        if styles:
            parts.append(f'visual style: {", ".join(list(styles)[:3])}')
        if elements:
            parts.append(f'graphic elements: {", ".join(list(elements)[:3])}')
        if vibes:
            parts.append(f'vibe: {", ".join(list(vibes)[:3])}')

    parts.append('high quality, print resolution, isolated design')

    prompt = ', '.join(parts)

    # Inject background color
    bg_hex = Design.BG_COLOR_HEX.get(background_color, '#D3D3D3')
    bg_instruction = (
        f"Background: solid {bg_hex} color, saturated, no gradients, "
        f"no patterns, flat single color background"
    )

    return f"{prompt}\n{bg_instruction}"


def build_from_sources(
    sources_config: dict,
    idea=None,
    keywords: list | None = None,
    research_data: dict | None = None,
    image_analysis: dict | None = None,
    background_color: str = 'light_gray',
    variant_index: int = 0,
) -> str:
    """Build prompt by combining multiple source types.

    Args:
        sources_config: {slogan, keywords, research, web_research, image} booleans
        idea: Idea model instance (if slogan source enabled)
        keywords: list of keyword strings (if keywords source enabled)
        research_data: dict with niche research fields (if research source enabled)
        image_analysis: 7-step analysis output (if image source enabled)
        background_color: BackgroundColor choice value
        variant_index: 0-4, controls stylistic variation
    """
    parts = []

    # -- Slogan source --
    if sources_config.get('slogan') and idea:
        parts.append(f'T-shirt design with text: "{idea.slogan_text}"')
        if idea.emotional_archetype:
            parts.append(f'emotional tone: {idea.emotional_archetype}')
        if idea.signal_type:
            parts.append(f'signal type: {idea.signal_type}')

    # -- Keywords source --
    if sources_config.get('keywords') and keywords:
        top_kw = keywords[:10]
        parts.append(f'design theme keywords: {", ".join(top_kw)}')

    # -- Research source (niche research data) --
    if sources_config.get('research') and research_data:
        if research_data.get('visual_styles'):
            parts.append(f'visual style: {", ".join(research_data["visual_styles"][:3])}')
        if research_data.get('graphic_elements'):
            parts.append(
                f'graphic elements: {", ".join(research_data["graphic_elements"][:3])}',
            )
        if research_data.get('vibes'):
            parts.append(f'vibe: {", ".join(research_data["vibes"][:3])}')
        if research_data.get('tones'):
            parts.append(f'tone: {", ".join(research_data["tones"][:3])}')

    # -- Web Research source --
    if sources_config.get('web_research') and research_data:
        trends = research_data.get('web_trends')
        if trends:
            parts.append(f'market trend context: {trends}')

    # -- Image source (7-step analysis) --
    if sources_config.get('image') and image_analysis:
        final_prompt = image_analysis.get('final_prompt', '')
        if final_prompt:
            parts.append(f'inspired by: {final_prompt[:300]}')
        else:
            visual = image_analysis.get('visual', {})
            if visual.get('style'):
                parts.append(f'visual reference: {visual["style"]}')

    # Stylistic variation per variant_index
    variant_styles = [
        'high quality, print resolution, isolated design',
        'bold and eye-catching, modern graphic design, clean lines',
        'vintage retro style, distressed texture, classic typography',
        'minimalist, clean, subtle, elegant design',
        'hand-drawn illustration style, artistic, textured',
    ]
    style_suffix = variant_styles[variant_index % len(variant_styles)]
    parts.append(style_suffix)

    prompt = ', '.join(parts)

    # Background color injection
    bg_hex = Design.BG_COLOR_HEX.get(background_color, '#D3D3D3')
    bg_instruction = (
        f"Background: solid {bg_hex} color, saturated, no gradients, "
        f"no patterns, flat single color background"
    )

    return f"{prompt}\n{bg_instruction}"

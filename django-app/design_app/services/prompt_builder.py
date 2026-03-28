"""Prompt construction for design generation.

Two paths:
- image-driven: from 7-step analysis output
- idea-driven: from Idea DB fields + NicheResearch analysis
"""

import logging

from design_app.models import Design

logger = logging.getLogger(__name__)


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

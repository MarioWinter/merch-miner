"""Prompt construction for design generation.

Three paths:
- image-driven: from 7-step analysis output
- idea-driven: from Idea DB fields + NicheResearch analysis
- PROJ-34 form-based: `build_form_prompt` composes the Architect template +
  8 ordered slot sentences (Appendix N.2 / N.3).
"""

from __future__ import annotations

import logging
import re
from uuid import UUID

from design_app.models import Design
from design_app.services.style_library import (
    ARCHITECT_TEMPLATE_END,
    ARCHITECT_TEMPLATE_START,
    SLOT_SCHEMA,
    SPATIAL_OPTIONS,
    STYLE_LIBRARY,
    get_font_combination_by_id,
    get_typography_by_id,
)

logger = logging.getLogger(__name__)


# UUID matcher used by `_resolve_spatial` to distinguish a CustomSpatial
# reference from a built-in id / inline raw-text override.
_UUID_RE = re.compile(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
    r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
)

def _fallback_style(style_slug: str) -> dict:
    """Defensive fallback when `style_slug` is not in STYLE_LIBRARY.

    Returns a minimal entry so the form prompt still composes; auto-default
    fields stay empty so the resolver simply omits those sentences.
    """
    return {
        'label': style_slug.replace('_', ' ').title(),
        'prompt_suffix': 'Commercial vector design',
        # Phase 13j: typography is now an id resolved via get_typography_by_id.
        'default_typography_id': '',
        'default_style_dna': '',
        'default_spatial_id': None,
    }


def _resolve_spatial(
    *,
    user_val: str,
    niche_hint_id: str | None,
    style_default_id: str | None,
    workspace_id: str | None,
) -> str:
    """Resolve `slots.spatial_configuration` per Appendix N.3 (part 2).

    Returns the rendered prompt-text (str) or '' to omit the sentence.

    Order:
      1) user_val is a built-in id          -> SPATIAL_OPTIONS[id].prompt_text
      2) user_val is a UUID                 -> CustomSpatial lookup (ws-scoped)
      3) user_val is non-empty raw string   -> use as-is (legacy / inline custom)
      4) niche_hint_id is a built-in id     -> SPATIAL_OPTIONS[id].prompt_text
      5) style_default_id                   -> SPATIAL_OPTIONS[id].prompt_text
      6) else                               -> '' (omit sentence)
    """
    builtin_ids = {opt['id']: opt['prompt_text'] for opt in SPATIAL_OPTIONS}

    # 1) explicit built-in id
    if user_val in builtin_ids:
        return builtin_ids[user_val]

    # 2) explicit UUID -> CustomSpatial. The model lands in Phase 13d; until
    # then the import fails and we gracefully fall through. Workspace scope
    # is enforced — `workspace_id is None` short-circuits the lookup so
    # cross-tenant leakage is impossible. A UUID-shaped value is NEVER
    # treated as raw text: if the lookup misses we continue to niche-hint
    # / style-default / omit rather than leaking the UUID string into the
    # final prompt (see directive override of Appendix N.3 part 2 step 3).
    user_val_is_uuid = bool(user_val and _UUID_RE.match(user_val))
    if user_val_is_uuid and workspace_id:
        try:
            from design_app.models import CustomSpatial  # noqa: WPS433
        except ImportError:
            CustomSpatial = None  # type: ignore[assignment]

        if CustomSpatial is not None:
            try:
                cs = CustomSpatial.objects.get(
                    id=UUID(user_val),
                    workspace_id=workspace_id,
                    is_deleted=False,
                )
                return cs.prompt_text
            except CustomSpatial.DoesNotExist:
                # Soft-deleted between preset-save and now → drop through.
                pass

    # 3) explicit raw text override (legacy / inline "Custom…" path). Skip
    # for UUID-shaped values so a failed CustomSpatial lookup does not
    # leak the UUID into the rendered prompt.
    if user_val and not user_val_is_uuid:
        return user_val

    # 4) niche-hint id
    if niche_hint_id and niche_hint_id in builtin_ids:
        return builtin_ids[niche_hint_id]

    # 5) style default
    if style_default_id and style_default_id in builtin_ids:
        return builtin_ids[style_default_id]

    # 6) omit
    return ''


def _resolve_slot(slot, user_slots, niche_hints, style, slogan, workspace_id=None):
    """Resolve a single slot per Appendix N.3 fallback chain.

    Order (per non-spatial slot):
      1. explicit user value
      2. niche-hint value (if the slot supports niche hints)
      3. style auto-default (if the slot supports style defaults)
      4. omit (empty string)
    """
    # SPATIAL is special — delegate to _resolve_spatial.
    if slot['key'] == 'spatial_configuration':
        return _resolve_spatial(
            user_val=(user_slots or {}).get('spatial_configuration', '').strip(),
            niche_hint_id=(niche_hints or {}).get('spatial'),
            style_default_id=style.get('default_spatial_id'),
            workspace_id=workspace_id,
        )

    # Phase 13l — typography_adjectives is silenced when the user explicitly
    # set a font_combination. The font_combination sentence carries the
    # typographic anatomy on its own, so emitting both would duplicate /
    # contradict the font instructions.
    if slot['key'] == 'typography_adjectives':
        combo = (user_slots or {}).get('font_combination', '').strip()
        if combo:
            return ''

    # Phase 13l — font_combination slot resolution. Standard chain WITHOUT
    # niche-hint and WITHOUT style-default:
    #   1) explicit user value matching a built-in id → prompt_text
    #   2) explicit raw text override (legacy / inline custom)
    #   3) otherwise omit
    if slot['key'] == 'font_combination':
        user_val_combo = (user_slots or {}).get('font_combination', '').strip()
        if not user_val_combo:
            return ''
        entry = get_font_combination_by_id(user_val_combo)
        if entry:
            return entry['prompt_text']
        return user_val_combo

    # 1. Explicit user value wins
    user_val = (user_slots or {}).get(slot['key'], '').strip()
    if user_val:
        return user_val

    # 2. Niche-hint, if available + this slot supports niche hints
    hint_key = slot.get('niche_hint_key')
    if hint_key and niche_hints:
        hint_val = (niche_hints.get(hint_key) or '').strip()
        if hint_val:
            return hint_val

    # 3. Style auto-default, if this slot supports style defaults
    if slot.get('style_auto_default'):
        # Phase 13j: typography_adjectives' style-default is an id (resolved
        # via get_typography_by_id → prompt_text). User-typed values and
        # niche-hint values are raw text and stay raw — only this style-
        # default path goes through the id lookup. If the id is unknown,
        # gracefully omit the sentence (EC-35).
        mapping = {
            'typography_adjectives': 'default_typography_id',
            'style_dna': 'default_style_dna',
        }
        mapped_key = mapping.get(slot['key'])
        val = style.get(mapped_key, '')
        if slot['key'] == 'typography_adjectives' and val:
            entry = get_typography_by_id(val)
            return entry['prompt_text'] if entry else ''
        return val

    # 4. Special: visual_description ALWAYS needs SOMETHING if requested.
    #    If we end up here with no user value + no hint + no style default,
    #    return empty string so the slot is OMITTED from the prompt (per EC-24).
    return ''


def build_form_prompt(
    slogan: str,
    style_slug: str,
    *,
    slots: dict,
    background_color: str,
    niche_hints: dict | None = None,
    workspace_id: str | None = None,
) -> str:
    """PROJ-34 Phase 13b — assemble one Architect prompt from form slots.

    Composition (Appendix N.2):
      ARCHITECT_TEMPLATE_START.format(bg_hex=...)
        + each filled SLOT_SCHEMA entry rendered via its `render_template`
        + ARCHITECT_TEMPLATE_END

    Slot resolution follows the fallback chain in `_resolve_slot`:
      explicit user value → niche hint → style auto-default → omit.

    The slogan is double-quoted and prepended to the first slot sentence so
    the LLM always sees the literal text it must render (mirrors v1 behaviour
    and AC-7).

    Output is typically 600–1500 chars after Phase 13t-q's enriched slot
    descriptors. No length cap — the anti-gradient/no-glow clauses in
    ARCHITECT_TEMPLATE_END are non-negotiable per AC-48 and must always
    survive in the final prompt (Phase 13t-t removed the 1500-char truncate
    that was cutting them off).
    """
    style = STYLE_LIBRARY.get(style_slug) or _fallback_style(style_slug)
    bg_hex = Design.BG_COLOR_HEX.get(background_color, '#D3D3D3')

    parts: list[str] = [ARCHITECT_TEMPLATE_START.format(bg_hex=bg_hex)]

    # Slogan sentence — always present, sits between the opening template
    # line and the first resolved slot sentence so the LLM binds the quoted
    # text to a typographic role before the layout details arrive.
    parts.append(
        f'The design features the slogan text "{slogan}" as the primary '
        f'typographic element.'
    )

    for slot in SLOT_SCHEMA:
        value = _resolve_slot(
            slot, slots, niche_hints, style, slogan, workspace_id=workspace_id,
        )
        if value:
            parts.append(slot['render_template'].format(value=value))

    parts.append(ARCHITECT_TEMPLATE_END)
    return ' '.join(parts)


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

"""PROJ-34 — backend mirror of the 15-style frontend library (Appendix E).

The frontend ships `frontend-ui/src/views/designs/board/constants/styleLibrary.ts`
with the same 15 entries; this module is the backend source of truth for
slug → label / promptSuffix lookup used by `build_architect_prompt`.

If a future entry is added it must be mirrored in both files.

PROJ-34 Phase 13a adds the Architect template scaffolding + 36 spatial variants
+ 5 fixed-option dropdown lists (Appendices J.1–J.8, K) used by the form-based
Builder. Existing `STYLE_LIBRARY` entries gain 4 new auto-default fields
(`default_typography`, `default_material`, `default_style_dna`,
`default_spatial_id`) per Appendix K.
"""

from __future__ import annotations

# ─── Architect template scaffolding (Appendix J.1 / J.2) ──────────────────
# `{bg_hex}` is replaced at render time with the design's background hex.
ARCHITECT_TEMPLATE_START = (
    "A professional vector print design isolated on a {bg_hex} background."
)

# No placeholders. Anti-gradient/glow/shadow clauses are non-negotiable per
# the user's POD-print requirement (covers AC-48 + the "no gradients ever"
# user story).
ARCHITECT_TEMPLATE_END = (
    "High contrast, clean outlines, commercial vector art. Screen print "
    "ready, hard edges, no gradients, no glow effects, no soft shadows, "
    "no drop shadows, vector sharpness, 300 DPI."
)


# ─── Slot schema (Appendix J.3) ────────────────────────────────────────────
# 8 ordered slots, rendered between ARCHITECT_TEMPLATE_START and
# ARCHITECT_TEMPLATE_END by `prompt_builder.build_form_prompt`.
SLOT_SCHEMA = [
    {
        'key': 'spatial_configuration',
        'label': 'Spatial Configuration',
        'render_template': '{value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'spatial',
    },
    {
        'key': 'visual_description',
        'label': 'Visual Description',
        'render_template': 'The illustration features {value}.',
        'has_dropdown': False, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'visual',
    },
    {
        'key': 'text_segmentation',
        'label': 'Text Segmentation',
        'render_template': 'The typography is integrated into the layout: {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': None,
    },
    {
        'key': 'typography_adjectives',
        'label': 'Typography Adjectives',
        'render_template': "The text is rendered in a {value} font style.",
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': True, 'niche_hint_key': None,
    },
    {
        'key': 'accessories',
        'label': 'Accessories',
        'render_template': 'The design features {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'accessories',
    },
    {
        'key': 'material_texture',
        'label': 'Material / Texture',
        'render_template': 'The graphics are made of {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': True, 'niche_hint_key': 'material',
    },
    {
        'key': 'style_dna',
        'label': 'Style DNA',
        'render_template': '{value}.',
        'has_dropdown': False, 'has_custom_text': False,
        'style_auto_default': True, 'niche_hint_key': None,
    },
    {
        'key': 'extra_context',
        'label': 'Extra Context',
        'render_template': '{value}.',
        'has_dropdown': False, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': None,
    },
]


# ─── Spatial options (Appendix J.4) — 36 entries ──────────────────────────
# Each entry is a dict with stable `id` (snake_case), `ui_label` (≤24 chars),
# `ui_description` (≤90 chars), `thumbnail_path` (under
# `design_app/static/design_app/thumbnails/spatial/`), and `prompt_text`
# (40–70 word Architect-grade layout description). Thumbnails are generated
# by the script in Appendix R (future task).
#
# The first 6 ids (`vertical_stack` … `text_overlay`) preserve the v1 spec
# wording so any hand-saved v1 BuilderPreset that stored a free-text override
# matching them remains compatible. The remaining 30 entries are new.
SPATIAL_OPTIONS = [
    # ─── Classic foundation layouts ────────────────────────────────────────
    {
        "id": "vertical_stack",
        "ui_label": "Vertical Stack",
        "ui_description": "Text above, illustration center, text below — POD classic",
        "thumbnail_path": "thumbnails/spatial/vertical_stack.png",
        "prompt_text": "Vertical stack layout where text sits above and below a central illustration, with generous padding and breathing room between the text lines and the graphic. The composition reads top-to-bottom: headline, illustration, supporting line. Equal horizontal centering throughout.",
    },
    {
        "id": "horizontal_row",
        "ui_label": "Horizontal Row",
        "ui_description": "Illustration left, stacked text right (or mirrored)",
        "thumbnail_path": "thumbnails/spatial/horizontal_row.png",
        "prompt_text": "Horizontal row layout with the illustration anchored on the left half of the canvas and stacked text lines on the right half, separated by a generous vertical gutter of breathing room. Both blocks are vertically centered relative to each other.",
    },
    {
        "id": "badge_emblem",
        "ui_label": "Badge Emblem",
        "ui_description": "Round badge, illustration inside, slogan curved on arcs",
        "thumbnail_path": "thumbnails/spatial/badge_emblem.png",
        "prompt_text": "Badge emblem layout with the illustration centered inside a circular border, the primary slogan curving along the top arc of the badge and an accent phrase curving along the bottom arc. Thin double-line border separates inner and outer rings.",
    },
    {
        "id": "banner_top",
        "ui_label": "Banner Top",
        "ui_description": "Ribbon banner at top, illustration fills below",
        "thumbnail_path": "thumbnails/spatial/banner_top.png",
        "prompt_text": "Banner ribbon at the top of the canvas carrying the primary text inside it, with the illustration filling the lower two-thirds of the canvas and generous padding around it. The banner's tails curl slightly outward at the canvas edges.",
    },
    {
        "id": "headline_top_subtitle_bottom",
        "ui_label": "Headline + Subtitle",
        "ui_description": "Bold headline top, illustration center, small subtitle bottom",
        "thumbnail_path": "thumbnails/spatial/headline_top_subtitle_bottom.png",
        "prompt_text": "Single bold headline anchored at the top edge, the illustration filling the center of the canvas with breathing room around it, and a smaller subtitle line anchored at the bottom edge. Strong top-bottom symmetry, generous vertical breathing room.",
    },
    {
        "id": "text_overlay",
        "ui_label": "Text Overlay",
        "ui_description": "Slogan rendered ON TOP of the illustration",
        "thumbnail_path": "thumbnails/spatial/text_overlay.png",
        "prompt_text": "Overlay layout where the slogan text is rendered directly ON TOP of the centered illustration with a high-contrast outline or knockout stroke around each letter so the text stays fully legible against the artwork beneath it.",
    },
    # ─── Pure typographic layouts (text-only, no illustration) ────────────
    {
        "id": "stacked_word_block",
        "ui_label": "Stacked Word Block",
        "ui_description": "4–6 centered text lines, sizes vary, no illustration",
        "thumbnail_path": "thumbnails/spatial/stacked_word_block.png",
        "prompt_text": "Pure typographic stacked-word block with 4 to 6 horizontally centered text lines of varying font sizes and weights, no illustration. The visual hierarchy makes the central emphasis word the largest, the framing lines smaller and lighter. Even vertical spacing between lines.",
    },
    {
        "id": "knockout_text",
        "ui_label": "Knockout Text",
        "ui_description": "Slogan cut out of a single solid shape",
        "thumbnail_path": "thumbnails/spatial/knockout_text.png",
        "prompt_text": "Knockout reverse layout where the slogan text is cut out of a single solid filled shape — a rectangle, oval, or rounded plaque — so the canvas background shows through the letterforms. No separate illustration. The shape fills most of the canvas with even padding to the edges.",
    },
    {
        "id": "big_word_tiny_tag",
        "ui_label": "Big Word + Tiny Tag",
        "ui_description": "One huge word, tiny subtitle, no illustration",
        "thumbnail_path": "thumbnails/spatial/big_word_tiny_tag.png",
        "prompt_text": "Single dominant word filling roughly two-thirds of the canvas in massive heavyweight type, with a small subtitle line in tiny all-caps anchored centered immediately beneath it. No separate illustration. The supporting line is one-tenth the size of the dominant word.",
    },
    {
        "id": "word_as_shape",
        "ui_label": "Word-as-Shape",
        "ui_description": "Text bent to form a silhouette (heart, animal, …)",
        "thumbnail_path": "thumbnails/spatial/word_as_shape.png",
        "prompt_text": "Word-as-shape layout where the slogan text is bent, curved and arranged so the overall outline of the text block forms a recognizable silhouette — a heart, animal, or symbol related to the subject — without a separate illustration. The text itself IS the imagery.",
    },
    {
        "id": "diagonal_text",
        "ui_label": "Diagonal Text Block",
        "ui_description": "Slogan tilted 15–25° as a single rotated block",
        "thumbnail_path": "thumbnails/spatial/diagonal_text.png",
        "prompt_text": "Diagonal text block tilted 15 to 25 degrees off horizontal, the slogan stacked into 2 or 3 lines and rotated together as a single unit. Illustration is either omitted or sits subtly behind the text as a low-contrast silhouette. The diagonal cuts across the visual center.",
    },
    {
        "id": "pyramid_stack",
        "ui_label": "Pyramid Stack",
        "ui_description": "Lines growing/shrinking in size, pyramid silhouette",
        "thumbnail_path": "thumbnails/spatial/pyramid_stack.png",
        "prompt_text": "Pyramid word-stack layout with 4 to 5 stacked text lines forming a pyramid: the top line is shortest and smallest, each subsequent line wider and bolder, with the bottom line as the dominant emphasis word. No illustration. Tight vertical spacing for triangular cohesion.",
    },
    # ─── Frame / Stamp / Crest layouts ────────────────────────────────────
    {
        "id": "rectangular_frame",
        "ui_label": "Rectangular Frame",
        "ui_description": "Thin border, illustration center, text above + below",
        "thumbnail_path": "thumbnails/spatial/rectangular_frame.png",
        "prompt_text": "Rectangular frame layout with a thin border running around the canvas edge, the illustration centered inside the frame, and the slogan placed inside the frame above and below the illustration with generous interior padding. The frame has subtle ornamental corners.",
    },
    {
        "id": "crest_coat_of_arms",
        "ui_label": "Crest / Coat of Arms",
        "ui_description": "Heraldic vertical shield + banner + flanking elements",
        "thumbnail_path": "thumbnails/spatial/crest_coat_of_arms.png",
        "prompt_text": "Vertical heraldic crest layout with the illustration at the visual center inside a shield outline, a flowing banner ribbon underneath carrying the slogan, and decorative laurel-leaf or wing motifs flanking the shield on left and right. Symmetric on the vertical axis.",
    },
    {
        "id": "postage_stamp",
        "ui_label": "Postage Stamp",
        "ui_description": "Perforated jagged border, denomination tag, framed",
        "thumbnail_path": "thumbnails/spatial/postage_stamp.png",
        "prompt_text": "Postage-stamp layout with a perforated jagged-edge border around the canvas, a small denomination tag in one upper corner, the illustration filling the inner stamp area, and the slogan running along the bottom of the inner stamp frame. Visible perforation dots on all four edges.",
    },
    {
        "id": "hexagon_medallion",
        "ui_label": "Hexagon Medallion",
        "ui_description": "Hexagon or diamond outline, illustration inside",
        "thumbnail_path": "thumbnails/spatial/hexagon_medallion.png",
        "prompt_text": "Hexagonal medallion layout with the illustration centered inside a sharp hexagon or diamond outline, the slogan placed above the medallion and an accent word below it. Sharp geometric border lines, no rounded corners, strict symmetry.",
    },
    {
        "id": "road_sign",
        "ui_label": "Road Sign / Placard",
        "ui_description": "Octagon / triangle / shield sign with legend",
        "thumbnail_path": "thumbnails/spatial/road_sign.png",
        "prompt_text": "Road-sign placard layout shaped like an octagon, triangle, or highway-shield outline filling most of the canvas. The slogan is rendered as the sign legend in centered all-caps inside the sign shape. The illustration, if any, is small and tucked into one corner.",
    },
    # ─── Listing / definition / structured layouts ────────────────────────
    {
        "id": "definition_entry",
        "ui_label": "Dictionary Definition",
        "ui_description": "Headword, phonetics, part-of-speech, paragraph",
        "thumbnail_path": "thumbnails/spatial/definition_entry.png",
        "prompt_text": "Dictionary-definition layout with the headword in large bold at the top, a phonetic pronunciation guide in brackets plus a part-of-speech label on the second line, then a multi-line definition paragraph beneath set in a smaller serif. No separate illustration.",
    },
    {
        "id": "knolling_grid",
        "ui_label": "Knolling Grid",
        "ui_description": "4–9 illustrated items in a tidy uniform grid + title bar",
        "thumbnail_path": "thumbnails/spatial/knolling_grid.png",
        "prompt_text": "Knolling-grid layout with 4 to 9 small illustrated objects arranged in a tidy uniform grid (e.g. 3×3 or 3×2), each separated by equal padding, and a centered title bar across the top spanning the full grid width carrying the slogan.",
    },
    {
        "id": "anatomy_diagram",
        "ui_label": "Anatomy Diagram",
        "ui_description": "Central illustration with labeled pointer lines",
        "thumbnail_path": "thumbnails/spatial/anatomy_diagram.png",
        "prompt_text": "Anatomy-diagram layout with the central illustration in the middle of the canvas, thin pointer lines radiating outward to small text labels at multiple cardinal positions around it, and the slogan or title placed at the very top of the canvas as a header.",
    },
    {
        "id": "checklist",
        "ui_label": "Checklist",
        "ui_description": "4–6 stacked lines, each with a checkbox tick",
        "thumbnail_path": "thumbnails/spatial/checklist.png",
        "prompt_text": "Vertical checklist layout with 4 to 6 stacked text lines, each preceded by a small checkbox or tick icon, a header line at the top carrying the title, generous line height between items, and no separate illustration. The list is centered horizontally on the canvas.",
    },
    {
        "id": "periodic_tile",
        "ui_label": "Periodic Element Tile",
        "ui_description": "Square tile, atomic-number style, symbol + name",
        "thumbnail_path": "thumbnails/spatial/periodic_tile.png",
        "prompt_text": "Periodic-table element-tile layout with a single square tile centered on the canvas, an atomic-number-style small digit in the top-left corner of the tile, a large symbol or word in the tile's center, and a longer name underneath the symbol. No separate illustration.",
    },
    {
        "id": "recipe_card",
        "ui_label": "Recipe / Ingredients Card",
        "ui_description": "Title, subtitle, bulleted ingredient list",
        "thumbnail_path": "thumbnails/spatial/recipe_card.png",
        "prompt_text": "Recipe-card layout with a headline title at the top, a small subtitle directly beneath, then an ingredients list of 4 to 6 short bulleted lines below, optionally a tiny garnish illustration anchored in one bottom corner. Even left alignment for the list, centered headline.",
    },
    # ─── Themed templates ─────────────────────────────────────────────────
    {
        "id": "vintage_postcard",
        "ui_label": "Vintage Postcard",
        "ui_description": "'Greetings from …' headline + small caption",
        "thumbnail_path": "thumbnails/spatial/vintage_postcard.png",
        "prompt_text": "Vintage-postcard layout with a 'Greetings from …' style phrase as the dominant headline filling the top half of the canvas in chunky stacked letters, a stylized illustration beneath the headline filling the lower half, and a small caption line at the very bottom.",
    },
    {
        "id": "sports_jersey",
        "ui_label": "Sports Jersey",
        "ui_description": "Massive number center, arched name + team name",
        "thumbnail_path": "thumbnails/spatial/sports_jersey.png",
        "prompt_text": "Sports-jersey layout with a massive sports-style number filling the visual center of the canvas, a player-name-style word arched above the number, and a smaller team-name caption arched below the number. No separate illustration — the typography is the whole composition.",
    },
    {
        "id": "movie_poster",
        "ui_label": "Movie Poster",
        "ui_description": "Central illustration, heavy title bottom, credit block",
        "thumbnail_path": "thumbnails/spatial/movie_poster.png",
        "prompt_text": "Movie-poster layout with the illustration filling the central two-thirds of the canvas, a dramatic title in heavyweight letters across the bottom third, and small credit-block lines tucked beneath the title. Vertical poster-aspect framing implied even on a square canvas.",
    },
    {
        "id": "license_plate",
        "ui_label": "License Plate",
        "ui_description": "Horizontal plate box with chunky plate letters",
        "thumbnail_path": "thumbnails/spatial/license_plate.png",
        "prompt_text": "License-plate layout with a horizontal rectangular plate-shaped box filling the canvas center, the slogan rendered in chunky license-plate-style block letters inside the box, and small region or state tags positioned above and below the plate rectangle.",
    },
    {
        "id": "concert_ticket",
        "ui_label": "Concert Ticket",
        "ui_description": "Ticket shape with perforation + stub",
        "thumbnail_path": "thumbnails/spatial/concert_ticket.png",
        "prompt_text": "Concert-ticket layout with a horizontal ticket-shape outline filling the canvas, dashed perforation lines running vertically to separate a stub from the main area, the headline event-name in the main ticket area, and small detail lines (date / time / seat) in the stub portion.",
    },
    {
        "id": "map_coordinates",
        "ui_label": "Map Coordinates",
        "ui_description": "Place name + GPS numbers + landmark line-art",
        "thumbnail_path": "thumbnails/spatial/map_coordinates.png",
        "prompt_text": "Map-coordinates layout with a city or place name as the dominant headline at the top, GPS-style coordinate numbers in a smaller caption immediately below it, and a minimal-line-art illustration of a landmark or geographic outline anchored below the coordinates.",
    },
    # ─── Asymmetric / compositional layouts ───────────────────────────────
    {
        "id": "off_center_text_wrap",
        "ui_label": "Off-Center Text Wrap",
        "ui_description": "Illustration on one side, text wraps its silhouette",
        "thumbnail_path": "thumbnails/spatial/off_center_text_wrap.png",
        "prompt_text": "Off-center composition with the illustration anchored to the right side of the canvas and the slogan text broken into multiple short lines that wrap and follow the silhouette edge of the illustration on the left, creating a flowing left-side text block.",
    },
    {
        "id": "diagonal_split",
        "ui_label": "Diagonal Split",
        "ui_description": "Canvas split along a diagonal: illustration vs. text",
        "thumbnail_path": "thumbnails/spatial/diagonal_split.png",
        "prompt_text": "Diagonal split layout where the canvas is divided into two triangular halves along a single diagonal line: the illustration fills one triangular half and the stacked slogan text fills the other triangular half. The diagonal line itself is a clean hard edge with no shading.",
    },
    {
        "id": "triptych_three_panel",
        "ui_label": "Triptych (3-Panel)",
        "ui_description": "Three vertical panels, each with a variant, header bar",
        "thumbnail_path": "thumbnails/spatial/triptych_three_panel.png",
        "prompt_text": "Triptych three-panel layout with the canvas divided into three vertical panels of equal width separated by thin dividers, a small illustration variation in each panel, and the slogan running across as a header bar spanning all three panels at the top.",
    },
    {
        "id": "concentric_circular_text",
        "ui_label": "Concentric Circular Text",
        "ui_description": "Rings of text running around a center illustration",
        "thumbnail_path": "thumbnails/spatial/concentric_circular_text.png",
        "prompt_text": "Concentric circular text layout with the illustration at the dead center of the canvas and one to three rings of text running around it: the outer ring as primary slogan, the inner ring as accent or date — all text aligned along its respective arc path.",
    },
    # ─── Speech / quote layouts ──────────────────────────────────────────
    {
        "id": "speech_bubble",
        "ui_label": "Speech Bubble",
        "ui_description": "Comic bubble with slogan, character below pointing up",
        "thumbnail_path": "thumbnails/spatial/speech_bubble.png",
        "prompt_text": "Comic speech-bubble layout with a rounded speech bubble in the upper half of the canvas holding the slogan inside it, and a small character illustration in the lower half from which the speech-bubble tail visually points. Classic comic-strip composition.",
    },
    {
        "id": "quote_marks_frame",
        "ui_label": "Quote Marks Frame",
        "ui_description": "Giant quotation marks bracket a centered slogan",
        "thumbnail_path": "thumbnails/spatial/quote_marks_frame.png",
        "prompt_text": "Quote-marks frame layout with two giant decorative quotation marks anchoring the upper-left and lower-right corners of the canvas, the slogan centered between them in an italic style. No separate illustration — the typography and the marks are the whole composition.",
    },
    # ─── Sunburst layout (full composition, distinct from sunburst accessory) ──
    {
        "id": "sunburst_layout",
        "ui_label": "Sunburst Layout",
        "ui_description": "Center illustration, rays to edges, text on arcs",
        "thumbnail_path": "thumbnails/spatial/sunburst_layout.png",
        "prompt_text": "Sunburst layout with the illustration sitting at the dead center of the canvas and straight ray lines radiating outward from behind it to the canvas edges, the slogan text running along the top arc above the rays and a secondary tag along the bottom arc beneath.",
    },
]


# ─── Fixed dropdown option lists (Appendices J.5 – J.8) ───────────────────
# Each list has exactly 6 entries shared across all 15 styles. The per-style
# auto-default picks ONE of these as the Builder's pre-selected value
# (Appendix K).

# J.5 — Text Segmentation (slot key: text_segmentation)
TEXT_SEGMENTATION_OPTIONS = [
    'a single centered slogan rendered as one block of text',
    'the slogan split in half, first half on top and second half on the bottom of the design',
    'a primary headline followed by a smaller subtitle line beneath it',
    'a three-line stacked block where the middle line is the largest emphasis word',
    'the slogan placed on a banner ribbon with one accent word sitting outside the ribbon',
    'two-tone segmentation where the dominant nouns are in one color/style and the connecting words in another',
]

# J.6 — Typography Adjectives (slot key: typography_adjectives)
# Each variant is wrapped in single-quotes inside the string so it slots
# into the Architect template "The text is rendered in a {value} font style."
# cleanly.
TYPOGRAPHY_OPTIONS = [
    "'massive heavyweight cartoon-block font with sharp rounded corners and internal white gloss lines'",
    "'thin casual hand-drawn marker font with slightly irregular wobble and rough ink-bleed edges'",
    "'chunky distressed varsity-collegiate serif with a heavyweight slab base and weathered worn-in texture'",
    "'ornate medieval blackletter font with decorative flourishes, dramatic thick-thin contrast and gothic terminals'",
    "'pixelated 8-bit monospace bitmap font with sharp uniform pixels and zero anti-aliasing'",
    "'elegant brush-script handwriting font with thick-thin contrast, ligatures and a confident calligraphic flow'",
]

# J.7 — Accessories (slot key: accessories) — multi-select on the frontend
ACCESSORIES_OPTIONS = [
    'white radiating motion-burst lines around the illustration',
    'a sparse scattering of small filled stars and tiny dots framing the design',
    'a thin geometric border frame enclosing the entire composition',
    'a curved banner ribbon underneath the illustration with secondary text on it',
    'sunburst rays radiating outward from behind the illustration',
    'halftone-dot accents in the negative space around the illustration',
]

# J.8 — Material / Texture (slot key: material_texture)
MATERIAL_OPTIONS = [
    'clean digital vector with flat color regions and crisp hard edges',
    'matte screenprint plastisol ink texture with subtle paper-grain underlay',
    'heavily distressed and weathered ink-bleed texture with cracked color fills',
    'halftone-dot color fills with classic comic-book printing aesthetic and a limited 2-3 color palette',
    'gritty vintage worn-on-fabric look with faded color washes and ink-loss patches',
    'high-contrast 2-color screenprint with bold blocky color regions and hand-cut stencil edges',
]


# ─── Spatial lookup helper ────────────────────────────────────────────────
# O(1) `id` → entry dict lookup. Built once at module import time. Used by
# the prompt builder (`_resolve_spatial`) and the spatial scrub validators
# (Phase 13d).
_SPATIAL_BY_ID = {entry['id']: entry for entry in SPATIAL_OPTIONS}


def get_spatial_by_id(spatial_id: str) -> dict | None:
    """Return the `SPATIAL_OPTIONS` entry whose `id` matches, or `None`."""
    if not spatial_id:
        return None
    return _SPATIAL_BY_ID.get(spatial_id)


STYLE_LIBRARY: dict[str, dict[str, str]] = {
    'vintage_retro': {
        'label': 'Vintage Retro',
        'short_description': 'Warm faded tones, thick outlines, distressed grain',
        'prompt_suffix': (
            'Vintage retro aesthetic with warm faded earth tones (mustard '
            'yellow, burnt orange, dusty teal, cream), thick uniform black '
            'outlines, slightly distressed grain texture overlay, halftone '
            'shading on flat color fills, weathered screen-print feel'
        ),
        # PROJ-34 Phase 13a (Appendix K) — Architect form auto-defaults.
        'default_typography': TYPOGRAPHY_OPTIONS[2],   # row 3 — varsity-collegiate
        'default_material': MATERIAL_OPTIONS[4],       # row 5 — vintage worn
        'default_style_dna': (
            'Vintage retro aesthetic with warm faded earth tones, thick '
            'uniform black outlines, and slight halftone shading on flat '
            'color fills'
        ),
        'default_spatial_id': 'vintage_postcard',
    },
    '70s_groovy': {
        'label': '70s Groovy',
        'short_description': 'Earthy psychedelic palette, flowing curves',
        'prompt_suffix': (
            '1970s groovy psychedelic vibe with bold flowing curved typography, '
            'earthy palette of mustard, burnt orange, olive, cream and rust, '
            'thick black outlines, soft halftone dot accents, retro disco '
            'poster aesthetic'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[5],   # row 6 — brush-script
        'default_material': MATERIAL_OPTIONS[1],       # row 2 — matte screenprint
        'default_style_dna': (
            '1970s groovy psychedelic aesthetic with bold flowing curves, '
            'earthy mustard-orange-olive palette, and retro disco-poster '
            'flatness'
        ),
        'default_spatial_id': 'concentric_circular_text',
    },
    '80s_neon': {
        'label': '80s Neon Synthwave',
        'short_description': 'Hot magenta + cyan + chrome glow',
        'prompt_suffix': (
            '1980s neon synthwave aesthetic with hot magenta, electric cyan, '
            'vibrant purple and matte black, chrome reflective typography, '
            'vaporwave grid background motifs, glowing neon outlines, retro '
            'arcade vibe'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[0],   # row 1 — cartoon-block
        'default_material': MATERIAL_OPTIONS[5],       # row 6 — high-contrast 2-color
        'default_style_dna': (
            '1980s synthwave aesthetic with hot magenta + electric cyan + '
            'matte black palette and crisp neon-arcade flatness — no actual '
            'glow effects, only saturated flat colors'
        ),
        'default_spatial_id': 'sunburst_layout',
    },
    '90s_grunge': {
        'label': '90s Grunge',
        'short_description': 'Distressed ink-bleed, faded high-contrast',
        'prompt_suffix': (
            '1990s grunge style with distressed ink-bleed textures, faded '
            'high-contrast palette of worn black, cream and faded red, '
            'torn-edge effects, gritty rough outlines, photocopy-worn '
            'screen-print look'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[2],   # row 3 — varsity-collegiate
        'default_material': MATERIAL_OPTIONS[2],       # row 3 — heavily distressed
        'default_style_dna': (
            '1990s grunge aesthetic with faded worn palette, torn-edge '
            'effects, gritty rough outlines and photocopy-worn screen-print '
            'look'
        ),
        'default_spatial_id': 'stacked_word_block',
    },
    'kawaii_chibi': {
        'label': 'Kawaii Chibi',
        'short_description': 'Cute oversized heads, sparkly eyes, pastels',
        'prompt_suffix': (
            'Kawaii chibi cartoon style with oversized cute heads, big '
            'sparkly black eyes with white highlights, soft pastel palette '
            '(baby pink, mint, lavender, butter yellow), thick rounded '
            'outlines, gentle pastel cell-shading, adorable expression'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[0],   # row 1 — cartoon-block
        'default_material': MATERIAL_OPTIONS[0],       # row 1 — clean digital vector
        'default_style_dna': (
            'Kawaii chibi cartoon aesthetic with oversized cute features, '
            'soft pastel palette, thick rounded outlines and gentle pastel '
            'cel-shading'
        ),
        'default_spatial_id': 'headline_top_subtitle_bottom',
    },
    'cartoon': {
        'label': 'Cartoon',
        'short_description': 'Thick outlines, flat fills, playful shapes',
        'prompt_suffix': (
            'Bold cartoon style with thick uniform black outlines, flat '
            'saturated color fills, simple cel-shaded highlights, expressive '
            'exaggerated features, playful vibrant palette, Saturday-morning '
            'animation aesthetic'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[0],   # row 1 — cartoon-block
        'default_material': MATERIAL_OPTIONS[0],       # row 1 — clean digital vector
        'default_style_dna': (
            'Bold cartoon aesthetic with thick uniform black outlines, flat '
            'saturated color fills, simple cel-shaded highlights and '
            'Saturday-morning animation flatness'
        ),
        'default_spatial_id': 'vertical_stack',
    },
    'watercolor': {
        'label': 'Watercolor',
        'short_description': 'Soft transparent washes, organic edges',
        'prompt_suffix': (
            'Watercolor illustration style with soft transparent color washes, '
            'irregular pigment edges, visible paper texture, organic flowing '
            'brush strokes, layered translucent pigment, hand-painted artisan '
            'feel'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[1],   # row 2 — hand-drawn marker
        'default_material': MATERIAL_OPTIONS[4],       # row 5 — vintage worn
        'default_style_dna': (
            'Watercolor illustration aesthetic with soft transparent washes, '
            'irregular pigment edges and visible paper-texture underlay — '
            'rendered with hard-edged compositional outlines for print '
            'fidelity'
        ),
        'default_spatial_id': 'vertical_stack',
    },
    'hand_drawn_sketch': {
        'label': 'Hand-Drawn Sketch',
        'short_description': 'Loose pencil strokes, imperfect linework',
        'prompt_suffix': (
            'Hand-drawn sketch style with loose pencil and pen strokes, '
            'visible construction lines, slightly imperfect organic linework, '
            'monochrome or muted color accents, charming sketchbook journal '
            'aesthetic'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[1],   # row 2 — hand-drawn marker
        'default_material': MATERIAL_OPTIONS[4],       # row 5 — vintage worn
        'default_style_dna': (
            'Hand-drawn sketchbook aesthetic with loose pencil strokes, '
            'visible construction lines, slightly imperfect organic linework '
            'and charming journal feel'
        ),
        'default_spatial_id': 'definition_entry',
    },
    'vector_flat': {
        'label': 'Vector Flat',
        'short_description': 'Clean modern flat shapes, no gradients',
        'prompt_suffix': (
            'Clean modern flat vector style with geometric shapes, zero '
            'gradients, smart minimalist palette, crisp sharp edges, '
            'contemporary commercial design aesthetic, editorial Apple-emoji '
            'flatness'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[0],   # row 1 — cartoon-block
        'default_material': MATERIAL_OPTIONS[0],       # row 1 — clean digital vector
        'default_style_dna': (
            'Modern flat-vector aesthetic with geometric shapes, zero '
            'gradients, minimalist palette, crisp sharp edges and '
            'editorial-emoji flatness'
        ),
        'default_spatial_id': 'headline_top_subtitle_bottom',
    },
    'minimal_line_art': {
        'label': 'Minimal Line Art',
        'short_description': 'Single-line monoline, lots of negative space',
        'prompt_suffix': (
            'Minimal single-line illustration with consistent monoline weight, '
            'no fills, no shading, elegant continuous lines, abundant negative '
            'space, refined editorial wordmark aesthetic'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[1],   # row 2 — hand-drawn marker
        'default_material': MATERIAL_OPTIONS[0],       # row 1 — clean digital vector
        'default_style_dna': (
            'Minimal single-line aesthetic with consistent monoline weight, '
            'no fills, no shading, abundant negative space and elegant '
            'wordmark refinement'
        ),
        'default_spatial_id': 'big_word_tiny_tag',
    },
    'pixel_art': {
        'label': 'Pixel Art',
        'short_description': '8-bit pixelated, 16-color retro palette',
        'prompt_suffix': (
            'Pixel art 8-bit gaming style with sharp pixelated edges, no '
            'anti-aliasing, limited 16-color retro arcade palette, blocky '
            'uniform pixels, nostalgic NES/Game Boy aesthetic'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[4],   # row 5 — pixelated 8-bit
        'default_material': MATERIAL_OPTIONS[0],       # row 1 — clean digital vector
        'default_style_dna': (
            '8-bit pixel-art aesthetic with sharp pixelated edges, no '
            'anti-aliasing, limited 16-color retro arcade palette and '
            'blocky uniform pixels'
        ),
        'default_spatial_id': 'periodic_tile',
    },
    'distressed_texture': {
        'label': 'Distressed Texture',
        'short_description': 'Worn ink, scratched fills, screenprint roughness',
        'prompt_suffix': (
            'Heavily distressed print texture with worn ink-bleed effect, '
            'scratched and cracked color fills, vintage screen-print '
            'roughness, aged-on-fabric look, rough rustic typography'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[2],   # row 3 — varsity-collegiate
        'default_material': MATERIAL_OPTIONS[2],       # row 3 — heavily distressed
        'default_style_dna': (
            'Heavily distressed print aesthetic with worn ink-bleed effect, '
            'scratched and cracked color fills, vintage screen-print roughness'
        ),
        'default_spatial_id': 'knockout_text',
    },
    'halftone_print': {
        'label': 'Halftone Print',
        'short_description': 'Dot-pattern fills, comic book look',
        'prompt_suffix': (
            'Halftone print style with dot-pattern color fills (varying dot '
            'sizes), classic comic-book printing aesthetic, limited 2-3 color '
            'palette, retro newsprint feel, pop-art flatness'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[0],   # row 1 — cartoon-block
        'default_material': MATERIAL_OPTIONS[3],       # row 4 — halftone-dot
        'default_style_dna': (
            'Halftone-print pop-art aesthetic with dot-pattern fills, '
            'limited 2-3 color palette and retro newsprint feel'
        ),
        'default_spatial_id': 'vertical_stack',
    },
    'badge_emblem': {
        'label': 'Badge / Emblem',
        'short_description': 'Circular emblem, banner ribbons, heritage crest',
        'prompt_suffix': (
            'Vintage badge emblem layout with circular or shield-shaped border, '
            'banner ribbons above and below, central crest illustration, '
            'classic monochrome or 2-color palette, heritage trade-mark feel'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[2],   # row 3 — varsity-collegiate
        'default_material': MATERIAL_OPTIONS[5],       # row 6 — high-contrast 2-color
        'default_style_dna': (
            'Vintage badge-emblem aesthetic with classic monochrome or '
            '2-color palette, heritage trade-mark feel and ornate '
            'border-frame structure'
        ),
        'default_spatial_id': 'badge_emblem',
    },
    'blackletter_gothic': {
        'label': 'Blackletter Gothic',
        'short_description': 'Heavy medieval typography, dark mood',
        'prompt_suffix': (
            'Heavy blackletter gothic typography with ornate medieval scripts, '
            'dramatic high-contrast strokes, decorative flourishes, dark moody '
            'palette, often paired with skull / raven / cross / banner motifs'
        ),
        'default_typography': TYPOGRAPHY_OPTIONS[3],   # row 4 — blackletter
        'default_material': MATERIAL_OPTIONS[5],       # row 6 — high-contrast 2-color
        'default_style_dna': (
            'Heavy blackletter-gothic aesthetic with ornate medieval scripts, '
            'decorative flourishes, dramatic high-contrast strokes and dark '
            'moody palette'
        ),
        'default_spatial_id': 'crest_coat_of_arms',
    },
}


# PROJ-34 Appendix C — warp slug → final-prompt phrase mapping.
WARP_PHRASES: dict[str, str] = {
    'arc_lower': (
        "The text uses an 'Arc Lower' warp: the headline remains straight at "
        "the top but arches downwards at the bottom to frame the illustration."
    ),
    'concave_squeeze': (
        "The typography uses a concave 'bowtie' warp, with massive tall "
        "letters on the far left and right flanks that strictly taper down to "
        "a smaller size in the center."
    ),
    'bulge': (
        "The typography features a convex bulge, making the center words "
        "massive and dominant while the edges taper off."
    ),
    'flag_wave': (
        "The text flows in a sinuous 'flag wave' motion, rising on the left "
        "and dipping on the right."
    ),
}

"""PROJ-34 — backend mirror of the 15-style frontend library (Appendix E).

The frontend ships `frontend-ui/src/views/designs/board/constants/styleLibrary.ts`
with the same 15 entries; this module is the backend source of truth for
slug → label / promptSuffix lookup used by `build_form_prompt`.

If a future entry is added it must be mirrored in both files.

PROJ-34 Phase 13a adds the Architect template scaffolding + 36 spatial variants
+ 5 fixed-option dropdown lists (Appendices J.1–J.8, K) used by the form-based
Builder. Existing `STYLE_LIBRARY` entries gain auto-default fields per
Appendix K. (Phase 13q dropped `default_material`; Phase 13t-u dropped
`default_spatial_id` AND `default_typography_id` so the style picker only
contributes the `default_style_dna` aesthetic descriptor + the (unused)
`prompt_suffix`. Style picker no longer auto-fills LAYOUT or TYPOGRAPHY.)

PROJ-34 Phase 13j rewrites `TYPOGRAPHY_OPTIONS` from 6 flat strings to 21
list-of-dicts (id / ui_label / ui_description / prompt_text), renames every
`default_typography` → `default_typography_id` on the 15 STYLE_LIBRARY entries
(stores an id, resolved via `get_typography_by_id` in the prompt builder), and
adds a `get_typography_by_id` lookup helper. Distress is rendered as
TRANSPARENT KNOCKOUT cutouts revealing the underlying garment color — never
as added white ink.

PROJ-34 Phase 13q removes the MATERIAL slot completely from the form-based
Architect Builder: `MATERIAL_OPTIONS`, the `material_texture` SLOT_SCHEMA
entry, and every `default_material` field on the 15 STYLE_LIBRARY entries
are deleted. Reason: MATERIAL is triple-redundant in the rendered Gemini
prompt — STYLE_DNA describes texture, ARCHITECT_TEMPLATE_END commits to
"screen print ready, hard edges, vector sharpness", and Rule #10 in
DESIGN_GEN_SYSTEM_PROMPT forbids gradients/glow/shadows.
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
# Phase 13q removed the `material_texture` slot (9 → 8 entries).
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
        'key': 'typography_adjectives',
        'label': 'Typography Adjectives',
        'render_template': "The text is rendered in a {value} font style.",
        'has_dropdown': True, 'has_custom_text': True,
        # Phase 13t-u: style_auto_default → False (was True). Style picker
        # no longer auto-fills typography; user must pick via the modal.
        'style_auto_default': False, 'niche_hint_key': None,
    },
    {
        'key': 'font_combination',
        'label': 'Font Combination',
        'render_template': '{value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': None,
    },
    {
        'key': 'accessories',
        'label': 'Accessories',
        'render_template': 'The design features {value}.',
        'has_dropdown': True, 'has_custom_text': True,
        'style_auto_default': False, 'niche_hint_key': 'accessories',
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


# ─── Spatial options (Appendix J.4) — 43 entries (36 base + 7 Phase 13o) ──
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
    # ─── Phase 13o additions (German POD layout-canon references) ─────────────
    {
        "id": "flush_aligned_block",
        "ui_label": "Flush-Aligned Block",
        "ui_description": "Multi-line text all aligned left or right, never centered",
        "thumbnail_path": "thumbnails/spatial/flush_aligned_block.png",
        "prompt_text": "Multi-line typographic block with all text lines flush-aligned to a single left or right edge (not centered), creating a vertical column of staircased line lengths. Pure typographic composition with no separate illustration. The flush edge creates a strong vertical axis and an editorial-magazine character.",
    },
    {
        "id": "full_canvas_word_block",
        "ui_label": "Full-Canvas Word Block",
        "ui_description": "Text fills entire canvas edge-to-edge, no breathing room",
        "thumbnail_path": "thumbnails/spatial/full_canvas_word_block.png",
        "prompt_text": "Massive text block filling the entire canvas edge-to-edge with minimal padding on all sides. Each line stretches across the full width, line heights are tight, and the typography itself becomes the full surface treatment. No separate illustration; the text IS the design.",
    },
    {
        "id": "vertical_pillar_text",
        "ui_label": "Vertical Pillar Text",
        "ui_description": "Text rotated 90° running vertically down the canvas height",
        "thumbnail_path": "thumbnails/spatial/vertical_pillar_text.png",
        "prompt_text": "Vertical pillar layout where the slogan text is rotated ninety degrees so it runs down the canvas height as a tall single-column line. Letters stack vertically as a continuous column or rotate together as one rotated word. The illustration, if any, sits small alongside the column with generous breathing room.",
    },
    {
        "id": "illustration_only_no_text",
        "ui_label": "Illustration Only (No Text)",
        "ui_description": "Pure visual composition with no slogan or text at all",
        "thumbnail_path": "thumbnails/spatial/illustration_only_no_text.png",
        "prompt_text": "Illustration-only composition where the entire canvas is given over to the artwork with no text or slogan present. The visual elements alone carry the message. The illustration sits centered with generous breathing room on all sides, no caption, no headline, no subtitle.",
    },
    {
        "id": "unconventional_integration",
        "ui_label": "Unconventional Integration",
        "ui_description": "Text breaks through or weaves between illustration in atypical ways",
        "thumbnail_path": "thumbnails/spatial/unconventional_integration.png",
        "prompt_text": "Unconventional integration layout where text breaks through, weaves between, or anchors against the illustration in an atypical non-grid arrangement. Letters may overlap edges of objects, illustrations may extend beyond the text bounds, and the relationship between type and image breaks the standard top-or-bottom-or-overlay grid.",
    },
    {
        "id": "crossed_tools_intersection",
        "ui_label": "Crossed Tools Intersection",
        "ui_description": "Two crossed tools/objects form an X with text wrapped around",
        "thumbnail_path": "thumbnails/spatial/crossed_tools_intersection.png",
        "prompt_text": "Crossed-tools intersection layout where two illustrated objects (axes, hammers, arrows, paddles, or similar implements) form an X across the canvas center, and the text wraps around the crossing — typically a primary line above the intersection and a smaller accent line below. Classic vintage-Americana craft composition.",
    },
    {
        "id": "subject_portrait_with_caption",
        "ui_label": "Subject Portrait + Caption",
        "ui_description": "Big subject portrait dominant with minimal caption underneath",
        "thumbnail_path": "thumbnails/spatial/subject_portrait_with_caption.png",
        "prompt_text": "Subject-portrait composition with a single dominant illustrated subject — a face, head, animal, or hero element — filling roughly the upper two-thirds of the canvas, and a minimal one- or two-line caption anchored at the bottom edge with generous breathing room. Album-cover or band-merch aesthetic.",
    },
]


# ─── Fixed dropdown option lists (Appendices J.5 – J.8) ───────────────────
# Each list has exactly 6 entries shared across all 15 styles. The per-style
# auto-default picks ONE of these as the Builder's pre-selected value
# (Appendix K).

# J.5 was TEXT_SEGMENTATION_OPTIONS — removed in Phase 13s. The slot was
# redundant with `spatial_configuration` which already prescribes how the
# slogan is segmented across the layout (e.g. headline_top_subtitle_bottom,
# stacked_word_block, banner_top, big_word_tiny_tag all prescribe text
# segmentation by their nature). The slot also has no niche-hint key and no
# style-default, so it required user attention without adding new value.

# J.6 — Typography Adjectives (slot key: typography_adjectives) — Phase 13j v2
# 22 dict entries (replaces the v1 6-string list). Each entry mirrors the
# SPATIAL_OPTIONS shape — including a `thumbnail_path` populated in Phase 13m-a
# pointing at a generated 512×512 PNG under `frontend-ui/public/typography-
# thumbnails/{id}.png`. Re-generate via
# `scripts/generate_typography_thumbnails.py`.
#
# The `prompt_text` is wrapped in single-quotes inside the string so it slots
# into the Architect template `"The text is rendered in a {value} font style."`
# cleanly. Each entry also includes `id` (snake_case, stable), `ui_label`
# (≤24 chars), and `ui_description` (≤90 chars).
#
# Distress is rendered as TRANSPARENT KNOCKOUT cutouts revealing the underlying
# garment color — never as added white ink (covers the recurring "white grunge"
# bug from Phase 13 v1).
TYPOGRAPHY_OPTIONS = [
    {
        "id": "distressed_vintage_slab",
        "ui_label": "Distressed Vintage Slab",
        "ui_description": "Heavy slab serif with transparent grunge cutouts",
        "thumbnail_path": "typography-thumbnails/distressed_vintage_slab.png",
        "prompt_text": "'heavyweight vintage slab-serif font with sturdy rectangular serif feet, slightly condensed proportions, uniform vertical stroke weight, and a coarse-grain screen-print distress pattern rendered as TRANSPARENT KNOCKOUT cutouts inside each letterform revealing the underlying garment color through the scratches — never as added white ink'",
    },
    {
        "id": "chunky_cartoon_block_gloss",
        "ui_label": "Cartoon Block (Gloss)",
        "ui_description": "Thick block letters with internal white gloss line",
        "thumbnail_path": "typography-thumbnails/chunky_cartoon_block_gloss.png",
        "prompt_text": "'massive heavyweight cartoon-block font with thick black outlines, generously rounded corners, internal white gloss highlight lines running across the upper third of each letter, and a friendly Saturday-morning animation feel'",
    },
    {
        "id": "distressed_industrial_sans",
        "ui_label": "Industrial Distressed Sans",
        "ui_description": "Condensed all-caps display with transparent distress",
        "thumbnail_path": "typography-thumbnails/distressed_industrial_sans.png",
        "prompt_text": "'heavyweight condensed all-caps display sans-serif font with squared terminals, no humanist warmth, and a heavy worn-screen-print distress pattern rendered as TRANSPARENT KNOCKOUT cutouts carved out of each letter revealing the underlying garment color through the scratches — never as added white ink'",
    },
    {
        "id": "varsity_script_swash",
        "ui_label": "Varsity Script + Swash",
        "ui_description": "Sports script with curving underline tail swash",
        "thumbnail_path": "typography-thumbnails/varsity_script_swash.png",
        "prompt_text": "'classic varsity sports-script font with confident italic slope, flowing brush-style thick-thin stroke contrast, joined cursive ligatures, a long horizontal underline swash tail beneath the lowercase baseline, and faint screen-print roughness rendered as TRANSPARENT ink-loss patches revealing the underlying garment color'",
    },
    {
        "id": "retro_diner_brush",
        "ui_label": "Retro Diner Brush",
        "ui_description": "50s brush-script with internal stripe/halftone fills",
        "thumbnail_path": "typography-thumbnails/retro_diner_brush.png",
        "prompt_text": "'retro 1950s brush-script font with bold thick-thin stroke contrast, casual italic slope, internal stripe or halftone-dot patterns rendered as TRANSPARENT KNOCKOUT cutouts inside each letterform revealing the underlying garment color, slightly playful uneven baseline, and a vintage hand-painted diner-signage character'",
    },
    {
        "id": "modern_elegant_brush",
        "ui_label": "Modern Elegant Brush",
        "ui_description": "Refined brush with ligatures, no distress",
        "thumbnail_path": "typography-thumbnails/modern_elegant_brush.png",
        "prompt_text": "'elegant modern brush-script font with refined thick-thin contrast, smooth confident ligatures, gentle italic slope, clean uniform line endings without distress, and a polished hand-lettered editorial character'",
    },
    {
        "id": "rounded_friendly_slab",
        "ui_label": "Rounded Friendly Slab",
        "ui_description": "Soft slab with rounded body corners",
        "thumbnail_path": "typography-thumbnails/rounded_friendly_slab.png",
        "prompt_text": "'rounded chunky slab-serif font with heavyweight bowls, gently rounded body corners, blunt soft slab feet, balanced proportions, low stroke contrast, and a friendly approachable character without distress'",
    },
    {
        "id": "seventies_groovy_bold",
        "ui_label": "70s Groovy Bold",
        "ui_description": "Flowing retro-disco curves",
        "thumbnail_path": "typography-thumbnails/seventies_groovy_bold.png",
        "prompt_text": "'1970s groovy bold display font with flowing organic curves, soft rounded apertures, slight wavy baseline irregularity, mild italic slope, condensed proportions, and an unmistakable retro disco-poster character'",
    },
    {
        "id": "playful_marker_script",
        "ui_label": "Playful Marker Script",
        "ui_description": "Casual hand-drawn marker, kid-style",
        "thumbnail_path": "typography-thumbnails/playful_marker_script.png",
        "prompt_text": "'casual hand-drawn marker-script font with thin slightly irregular strokes, organic wobble in the letterforms, rough ink-bleed edges, mixed-case or lowercase letterforms, and a friendly kid-style hand-written feel'",
    },
    {
        "id": "minimal_geometric_sans",
        "ui_label": "Minimal Geometric Sans",
        "ui_description": "Monoline editorial flat",
        "thumbnail_path": "typography-thumbnails/minimal_geometric_sans.png",
        "prompt_text": "'minimal geometric monoline sans-serif font with uniform stroke weight, perfectly circular bowls, no contrast, no humanist details, generous letter spacing, and a refined modern editorial character'",
    },
    {
        "id": "transitional_book_serif",
        "ui_label": "Book Serif",
        "ui_description": "Refined low-contrast classic body serif",
        "thumbnail_path": "typography-thumbnails/transitional_book_serif.png",
        "prompt_text": "'transitional refined book-serif font with moderate stroke contrast, bracketed serifs, balanced proportions, low x-height, calm restrained character, and the classic body-text feel of a printed novel'",
    },
    {
        "id": "western_country_slab",
        "ui_label": "Western Country Slab",
        "ui_description": "Heavyweight serif with sharp pointed spurs",
        "thumbnail_path": "typography-thumbnails/western_country_slab.png",
        "prompt_text": "'western country slab-serif font with heavyweight strokes, sharp pointed serif spurs flaring outward at the terminals, strong vertical impact, and slight rough-cut edge irregularity rendered as TRANSPARENT ink-loss cutouts along the outlines revealing the underlying garment color'",
    },
    {
        "id": "blackletter_gothic",
        "ui_label": "Blackletter Gothic",
        "ui_description": "Ornate medieval textura",
        "thumbnail_path": "typography-thumbnails/blackletter_gothic.png",
        "prompt_text": "'ornate medieval blackletter gothic font with dramatic thick-thin contrast, broken textura strokes, decorative spike flourishes at the terminals, narrow vertical proportions, and a dark monastic-manuscript character'",
    },
    {
        "id": "pixel_eight_bit_bitmap",
        "ui_label": "Pixel 8-bit Bitmap",
        "ui_description": "Sharp square pixels, retro arcade",
        "thumbnail_path": "typography-thumbnails/pixel_eight_bit_bitmap.png",
        "prompt_text": "'pixelated 8-bit bitmap font with sharp uniform square pixels, zero anti-aliasing, blocky stair-step diagonals, fixed monospace width, and a crisp retro arcade-game character'",
    },
    {
        "id": "athletic_jersey_sans",
        "ui_label": "Athletic Jersey Sans",
        "ui_description": "Clean billboard sports condensed",
        "thumbnail_path": "typography-thumbnails/athletic_jersey_sans.png",
        "prompt_text": "'clean heavyweight athletic-jersey sans-serif font with squared terminals, uniform stroke weight, slightly condensed proportions, no distress, slight italic slope, and a strong sports-billboard character'",
    },
    {
        "id": "chrome_bevel_display",
        "ui_label": "3D Chrome Bevel",
        "ui_description": "Hard-faceted metallic dimensional letters",
        "thumbnail_path": "typography-thumbnails/chrome_bevel_display.png",
        "prompt_text": "'3D chrome-bevel display font with sculpted dimensional letterforms, hard-edged facet transitions between bright and dark bevel planes, crisp metallic angled highlights painted as flat color regions, no gradients or blur, and an eye-catching trophy-style character'",
    },
    {
        "id": "childlike_rounded_block",
        "ui_label": "Childlike Rounded Block",
        "ui_description": "Kindergarten pastel-friendly bowls",
        "thumbnail_path": "typography-thumbnails/childlike_rounded_block.png",
        "prompt_text": "'childlike rounded cartoon-block sans-serif font with heavyweight bowls, generously rounded corners on both inside and outside of letterforms, no distress, no internal gloss line, friendly soft proportions, and a kindergarten-classroom playful character'",
    },
    {
        "id": "bubble_graffiti_letters",
        "ui_label": "Bubble Graffiti",
        "ui_description": "Puffy inflated streetwear letters",
        "thumbnail_path": "typography-thumbnails/bubble_graffiti_letters.png",
        "prompt_text": "'bubble-style graffiti font with bulging puffy letterforms, exaggerated rounded bowls swelling outward like inflated cushions, thick uniform stroke weight, generous interior counters, and a streetwear hand-spray-can character'",
    },
    {
        "id": "tattoo_old_school_bold",
        "ui_label": "Tattoo Old-School",
        "ui_description": "Bold woodcut with banner flourishes",
        "thumbnail_path": "typography-thumbnails/tattoo_old_school_bold.png",
        "prompt_text": "'old-school traditional-tattoo display font with heavyweight bold strokes, sharp serif terminals decorated with banner-ribbon flourishes, strong line variation, hand-inked nineteenth-century woodcut character, and confident sailor-banner attitude'",
    },
    {
        "id": "italic_handdrawn_indie",
        "ui_label": "Italic Indie",
        "ui_description": "Wobbly DIY zine slant",
        "thumbnail_path": "typography-thumbnails/italic_handdrawn_indie.png",
        "prompt_text": "'italic hand-drawn indie display font with intentionally uneven baseline, slanted irregular slope, slightly wobbly imperfect strokes, mixed-case letterforms, casual DIY zine character, and a self-published Etsy-handmade feel'",
    },
    {
        "id": "stencil_military_uniform",
        "ui_label": "Stencil Military",
        "ui_description": "Block strokes with stencil gaps",
        "thumbnail_path": "typography-thumbnails/stencil_military_uniform.png",
        "prompt_text": "'stencil military display font with uniform thick block-letter strokes interrupted by characteristic narrow gaps cutting through the body of each letter to mimic spray-stencil templates, all-caps, squared terminals, and a strict combat-issue character'",
    },
    {
        "id": "extruded_3d_block",
        "ui_label": "Extruded 3D Block",
        "ui_description": "Cartoon-block with hard-edged 3D side extrusion",
        "thumbnail_path": "typography-thumbnails/extruded_3d_block.png",
        "prompt_text": "'heavyweight extruded 3D cartoon-block font with thick uniform outlines, generously rounded letterforms, hard-edged dimensional side faces extending from each letter at a fixed depth, sharp flat facet transitions between the front face and the extruded side faces painted as separate flat-color regions with no gradients or blur, and a marquee-style comic-book depth character'",
    },
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

# J.8 — Material / Texture: REMOVED in Phase 13q (slot dropped entirely;
# texture is already covered by STYLE_DNA + ARCHITECT_TEMPLATE_END + Rule #10).


# ─── Font Combination options (Phase 13l) ─────────────────────────────────
# 8 dict entries, same shape as TYPOGRAPHY_OPTIONS (id / ui_label /
# ui_description / prompt_text). Each prompt_text is a COMPLETE grammatical
# sentence (no leading "a") because it slots into the Architect template
# `"{value}."` as a full sentence rather than into the
# `"The text is rendered in a {value} font style."` clause used by
# typography_adjectives.
#
# When a user selects a font_combination, the typography_adjectives sentence
# is omitted (the font_combination sentence carries the typographic
# anatomy) — enforced by `_resolve_slot` in prompt_builder.py.
FONT_COMBINATION_OPTIONS = [
    {
        "id": "serif_plus_sans_hierarchy",
        "ui_label": "Serif + Sans Hierarchy",
        "ui_description": "Serif headline paired with sans-serif body (or reverse)",
        "thumbnail_path": "font-combination-thumbnails/serif_plus_sans_hierarchy.png",
        "prompt_text": "The typography uses a two-font anatomical hierarchy: the primary headline is rendered in a heavyweight slab-serif or transitional book-serif font with bracketed serifs and balanced proportions, while the supporting lines are rendered in a heavyweight all-caps sans-serif font with squared terminals and uniform stroke weight, creating clear visual contrast between the serif structure of the hero and the calm sans-serif body",
    },
    {
        "id": "script_plus_block_hierarchy",
        "ui_label": "Script + Block Hierarchy",
        "ui_description": "Brush-script accent paired with chunky block primary",
        "thumbnail_path": "font-combination-thumbnails/script_plus_block_hierarchy.png",
        "prompt_text": "The typography uses a two-font emotional hierarchy: an accent line is rendered in an elegant brush-script font with thick-thin stroke contrast, smooth confident ligatures, and gentle italic slope, paired with a heavyweight all-caps cartoon-block or sans-serif primary line with thick uniform strokes, friendly rounded corners, and strong impact — the script carries personality while the block carries authority",
    },
    {
        "id": "single_font_color_hierarchy",
        "ui_label": "Single Font + Color Hierarchy",
        "ui_description": "One font, hierarchy driven by per-word color variation",
        "thumbnail_path": "font-combination-thumbnails/single_font_color_hierarchy.png",
        "prompt_text": "The typography uses a single heavyweight cartoon-block font family with thick black outlines and generously rounded corners across every line, but the hierarchy is driven entirely by per-word color variation — each significant word or line painted in a different flat saturated color so the eye reads importance through color rather than through font weight or family changes",
    },
    {
        "id": "vintage_slab_plus_script_accent",
        "ui_label": "Vintage Slab + Script Accent",
        "ui_description": "Distressed slab serif hero with curving script middle word",
        "thumbnail_path": "font-combination-thumbnails/vintage_slab_plus_script_accent.png",
        "prompt_text": "The typography uses a two-font Americana hierarchy: the primary headline and supporting lines are rendered in a heavyweight vintage slab-serif font with sturdy rectangular serif feet and a coarse-grain TRANSPARENT KNOCKOUT distress pattern revealing the underlying garment color, while a single accent word in the middle is rendered in a classic varsity-script font with curving brush strokes, joined ligatures, and a horizontal underline swash tail",
    },
    {
        "id": "athletic_sans_plus_script_sandwich",
        "ui_label": "Athletic Sans + Script Sandwich",
        "ui_description": "Sports-team sandwich — athletic sans top/bottom + script middle",
        "thumbnail_path": "font-combination-thumbnails/athletic_sans_plus_script_sandwich.png",
        "prompt_text": "The typography uses a three-tier sports-team sandwich: the top and bottom lines are rendered in a clean heavyweight athletic-jersey sans-serif font with squared terminals, uniform stroke weight, and slightly condensed proportions, while the middle accent word is rendered in a classic varsity-script font with confident italic slope, thick-thin contrast, and a horizontal underline swash tail — top and bottom act as anchors framing the script center",
    },
    {
        "id": "cartoon_block_plus_marker_script",
        "ui_label": "Cartoon Block + Marker Script",
        "ui_description": "Chunky cartoon-block hero with casual marker-script accent",
        "thumbnail_path": "font-combination-thumbnails/cartoon_block_plus_marker_script.png",
        "prompt_text": "The typography uses a two-font playful hierarchy: the primary hero line is rendered in a massive heavyweight cartoon-block font with thick outlines, internal white gloss highlight lines, and generously rounded corners, while an accent line above or below is rendered in a casual hand-drawn marker-script font with thin slightly irregular strokes, organic wobble, and a friendly kid-style hand-written feel",
    },
    {
        "id": "groovy_bold_plus_modern_brush_alternating",
        "ui_label": "Groovy Bold + Modern Brush",
        "ui_description": "Alternating lines: groovy bold + modern elegant brush",
        "thumbnail_path": "font-combination-thumbnails/groovy_bold_plus_modern_brush_alternating.png",
        "prompt_text": "The typography uses a two-font alternating-line hierarchy: half the lines are rendered in a 1970s groovy bold display font with flowing organic curves, soft rounded apertures, and slight wavy baseline irregularity, while the other lines are rendered in an elegant modern brush-script font with refined thick-thin contrast, smooth confident ligatures, and gentle italic slope — alternating line by line creates a rhythmic boho aesthetic",
    },
    {
        "id": "sans_frame_plus_color_hero",
        "ui_label": "Sans Frame + Color Hero",
        "ui_description": "Small sans frame top/bottom with multi-color cartoon-block hero",
        "thumbnail_path": "font-combination-thumbnails/sans_frame_plus_color_hero.png",
        "prompt_text": "The typography uses a frame-plus-hero hierarchy: small all-caps thin sans-serif lines anchor the top and bottom of the composition as framing captions with generous letter spacing, while the central hero text is rendered in a heavyweight cartoon-block font with each significant word or line painted in a different flat saturated color — the sans-serif frame stays uniform while the cartoon-block hero carries all the visual energy",
    },
    {
        "id": "vintage_slab_plus_modern_brush_accent",
        "ui_label": "Vintage Slab + Modern Brush Accent",
        "ui_description": "Distressed slab body with elegant modern brush on accent word",
        "thumbnail_path": "font-combination-thumbnails/vintage_slab_plus_modern_brush_accent.png",
        "prompt_text": "The typography uses a two-font vintage Americana hierarchy with a contemporary twist: the primary headline and supporting lines are rendered in a heavyweight vintage slab-serif font with sturdy rectangular serif feet and a coarse-grain TRANSPARENT KNOCKOUT distress pattern revealing the underlying garment color, while a single accent word in the middle is rendered in an elegant modern brush-script font with refined thick-thin contrast, smooth confident ligatures, gentle italic slope, and clean uniform line endings without distress — the slab body anchors the design while the modern brush adds a refined personal touch",
    },
    {
        "id": "body_sans_plus_extruded_emphasis",
        "ui_label": "Body Sans + 3D Extruded Emphasis",
        "ui_description": "Clean sans body lines with 3D-extruded cartoon-block on emphasis words",
        "thumbnail_path": "font-combination-thumbnails/body_sans_plus_extruded_emphasis.png",
        "prompt_text": "The typography uses a two-font emphasis hierarchy: the body lines are rendered in a clean heavyweight all-caps sans-serif font with squared terminals and uniform stroke weight for steady readability, while the emphasis words are rendered in a heavyweight extruded 3D cartoon-block font with hard-edged dimensional side faces extending at a fixed depth and sharp flat facet transitions between the front face and the side faces painted as separate flat-color regions with no gradients or blur — the sans body carries the message while the extruded block carries the impact",
    },
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


# ─── Typography lookup helper (Phase 13j) ─────────────────────────────────
# O(1) `id` → entry dict lookup over the 21 TYPOGRAPHY_OPTIONS entries.
# Used by `prompt_builder._resolve_slot` to resolve a user-picked typography
# id to its `prompt_text` before the Architect sentence is rendered.
# Phase 13t-u: style picker no longer carries default_typography_id, so this
# helper is now only hit from frontend-supplied user values.
_TYPOGRAPHY_BY_ID = {entry['id']: entry for entry in TYPOGRAPHY_OPTIONS}


def get_typography_by_id(typography_id: str) -> dict | None:
    """Return the `TYPOGRAPHY_OPTIONS` entry whose `id` matches, or `None`."""
    if not typography_id:
        return None
    return _TYPOGRAPHY_BY_ID.get(typography_id)


# ─── Font Combination lookup helper (Phase 13l) ───────────────────────────
# O(1) `id` → entry dict lookup over the 8 FONT_COMBINATION_OPTIONS entries.
# Used by `prompt_builder._resolve_slot` to resolve a user-selected font
# combination id to its `prompt_text` before the Architect sentence is
# rendered. Raw text overrides bypass this lookup entirely.
_FONT_COMBINATION_BY_ID = {entry['id']: entry for entry in FONT_COMBINATION_OPTIONS}


def get_font_combination_by_id(combo_id: str) -> dict | None:
    """Return the `FONT_COMBINATION_OPTIONS` entry whose `id` matches, or `None`."""
    if not combo_id:
        return None
    return _FONT_COMBINATION_BY_ID.get(combo_id)


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
        # Phase 13j: `default_typography` renamed to `default_typography_id`,
        # value is a TYPOGRAPHY_OPTIONS id (resolved via get_typography_by_id).
        'default_style_dna': (
            'Vintage retro aesthetic with warm faded earth tones, thick '
            'uniform black outlines, and slight halftone shading on flat '
            'color fills'
        ),
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
        'default_style_dna': (
            '1970s groovy psychedelic aesthetic with bold flowing curves, '
            'earthy mustard-orange-olive palette, and retro disco-poster '
            'flatness'
        ),
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
        'default_style_dna': (
            '1980s synthwave aesthetic with hot magenta + electric cyan + '
            'matte black palette and crisp neon-arcade flatness — no actual '
            'glow effects, only saturated flat colors'
        ),
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
        'default_style_dna': (
            '1990s grunge aesthetic with faded worn palette, torn-edge '
            'effects, gritty rough outlines and photocopy-worn screen-print '
            'look'
        ),
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
        'default_style_dna': (
            'Kawaii chibi cartoon aesthetic with oversized cute features, '
            'soft pastel palette, thick rounded outlines and gentle pastel '
            'cel-shading'
        ),
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
        'default_style_dna': (
            'Bold cartoon aesthetic with thick uniform black outlines, flat '
            'saturated color fills, simple cel-shaded highlights and '
            'Saturday-morning animation flatness'
        ),
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
        'default_style_dna': (
            'Watercolor illustration aesthetic with soft transparent washes, '
            'irregular pigment edges and visible paper-texture underlay — '
            'rendered with hard-edged compositional outlines for print '
            'fidelity'
        ),
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
        'default_style_dna': (
            'Hand-drawn sketchbook aesthetic with loose pencil strokes, '
            'visible construction lines, slightly imperfect organic linework '
            'and charming journal feel'
        ),
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
        'default_style_dna': (
            'Modern flat-vector aesthetic with geometric shapes, zero '
            'gradients, minimalist palette, crisp sharp edges and '
            'editorial-emoji flatness'
        ),
    },
    'minimal_line_art': {
        'label': 'Minimal Line Art',
        'short_description': 'Single-line monoline, lots of negative space',
        'prompt_suffix': (
            'Minimal single-line illustration with consistent monoline weight, '
            'no fills, no shading, elegant continuous lines, abundant negative '
            'space, refined editorial wordmark aesthetic'
        ),
        'default_style_dna': (
            'Minimal single-line aesthetic with consistent monoline weight, '
            'no fills, no shading, abundant negative space and elegant '
            'wordmark refinement'
        ),
    },
    'pixel_art': {
        'label': 'Pixel Art',
        'short_description': '8-bit pixelated, 16-color retro palette',
        'prompt_suffix': (
            'Pixel art 8-bit gaming style with sharp pixelated edges, no '
            'anti-aliasing, limited 16-color retro arcade palette, blocky '
            'uniform pixels, nostalgic NES/Game Boy aesthetic'
        ),
        'default_style_dna': (
            '8-bit pixel-art aesthetic with sharp pixelated edges, no '
            'anti-aliasing, limited 16-color retro arcade palette and '
            'blocky uniform pixels'
        ),
    },
    'distressed_texture': {
        'label': 'Distressed Texture',
        'short_description': 'Worn ink, scratched fills, screenprint roughness',
        'prompt_suffix': (
            'Heavily distressed print texture with worn ink-bleed effect, '
            'scratched and cracked color fills, vintage screen-print '
            'roughness, aged-on-fabric look, rough rustic typography'
        ),
        'default_style_dna': (
            'Heavily distressed print aesthetic with worn ink-bleed effect, '
            'scratched and cracked color fills, vintage screen-print roughness'
        ),
    },
    'halftone_print': {
        'label': 'Halftone Print',
        'short_description': 'Dot-pattern fills, comic book look',
        'prompt_suffix': (
            'Halftone print style with dot-pattern color fills (varying dot '
            'sizes), classic comic-book printing aesthetic, limited 2-3 color '
            'palette, retro newsprint feel, pop-art flatness'
        ),
        'default_style_dna': (
            'Halftone-print pop-art aesthetic with dot-pattern fills, '
            'limited 2-3 color palette and retro newsprint feel'
        ),
    },
    'badge_emblem': {
        'label': 'Badge / Emblem',
        'short_description': 'Circular emblem, banner ribbons, heritage crest',
        'prompt_suffix': (
            'Vintage badge emblem layout with circular or shield-shaped border, '
            'banner ribbons above and below, central crest illustration, '
            'classic monochrome or 2-color palette, heritage trade-mark feel'
        ),
        'default_style_dna': (
            'Vintage badge-emblem aesthetic with classic monochrome or '
            '2-color palette, heritage trade-mark feel and ornate '
            'border-frame structure'
        ),
    },
    'blackletter_gothic': {
        'label': 'Blackletter Gothic',
        'short_description': 'Heavy medieval typography, dark mood',
        'prompt_suffix': (
            'Heavy blackletter gothic typography with ornate medieval scripts, '
            'dramatic high-contrast strokes, decorative flourishes, dark moody '
            'palette, often paired with skull / raven / cross / banner motifs'
        ),
        'default_style_dna': (
            'Heavy blackletter-gothic aesthetic with ornate medieval scripts, '
            'decorative flourishes, dramatic high-contrast strokes and dark '
            'moody palette'
        ),
    },
    'comic_book': {
        'label': 'Comic Book',
        'short_description': 'Bold ink outlines, action-line accents, flat saturated fills',
        'prompt_suffix': (
            'Classic American comic-book aesthetic with bold uniform black ink '
            'outlines around every shape, flat saturated single-color fills with '
            'NO cel-shading and NO halftone-dot shading, hand-inked organic line '
            'weight variation, action-line accents (motion-bursts, impact-rays, '
            'speed-streaks) where energy is implied, vibrant primary-color palette '
            '(red / yellow / blue accents on a flat background), Marvel/DC '
            'superhero feel stripped of chiaroscuro shading'
        ),
        'default_style_dna': (
            'Classic American comic-book aesthetic with bold hand-inked outlines, '
            'flat saturated single-color fills, vibrant primary-color palette, '
            'action-line accents for energy — NO cel-shading, NO halftone-dot '
            'shading, NO gradients, only crisp flat areas of color separated by '
            'confident ink contour lines'
        ),
    },
}



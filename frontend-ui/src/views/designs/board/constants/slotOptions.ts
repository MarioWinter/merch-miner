// PROJ-34 Phase 13e — frontend mirror of backend Appendices J.4–J.8.
// Source of truth for the form-based Builder slot pickers (TextSegmentation,
// Typography, Accessories, Material) and for the SpatialPickerModal grid
// rendered in Phase 13f.
//
// IMPORTANT: every string MUST be copy-pasted verbatim from
// `django-app/design_app/services/style_library.py`. If a single character
// drifts, the `mirror_check` step in CI will fail (Phase 13a).
//
// Thumbnails resolve to `/static/design_app/{thumbnail_path}` served by the
// Django staticfiles app — see Appendix R for the generation script.

export interface SpatialOption {
  /** Stable identifier referenced from Appendix K + niche-LLM enum + presets. */
  id: string;
  /** Display label used in the SpatialPickerModal card. */
  ui_label: string;
  /** Short 1-line description shown below the label. */
  ui_description: string;
  /** Backend-relative path inside `design_app/static/design_app/`. */
  thumbnail_path: string;
  /** 40–70 word Architect-grade layout description injected into the prompt. */
  prompt_text: string;
}

// J.4 — 36 spatial layouts (mirrors backend SPATIAL_OPTIONS verbatim).
export const SPATIAL_OPTIONS: readonly SpatialOption[] = [
  // ─── Classic foundation layouts ──────────────────────────────────────────
  {
    id: 'vertical_stack',
    ui_label: 'Vertical Stack',
    ui_description: 'Text above, illustration center, text below — POD classic',
    thumbnail_path: 'thumbnails/spatial/vertical_stack.png',
    prompt_text:
      'Vertical stack layout where text sits above and below a central illustration, with generous padding and breathing room between the text lines and the graphic. The composition reads top-to-bottom: headline, illustration, supporting line. Equal horizontal centering throughout.',
  },
  {
    id: 'horizontal_row',
    ui_label: 'Horizontal Row',
    ui_description: 'Illustration left, stacked text right (or mirrored)',
    thumbnail_path: 'thumbnails/spatial/horizontal_row.png',
    prompt_text:
      'Horizontal row layout with the illustration anchored on the left half of the canvas and stacked text lines on the right half, separated by a generous vertical gutter of breathing room. Both blocks are vertically centered relative to each other.',
  },
  {
    id: 'badge_emblem',
    ui_label: 'Badge Emblem',
    ui_description: 'Round badge, illustration inside, slogan curved on arcs',
    thumbnail_path: 'thumbnails/spatial/badge_emblem.png',
    prompt_text:
      'Badge emblem layout with the illustration centered inside a circular border, the primary slogan curving along the top arc of the badge and an accent phrase curving along the bottom arc. Thin double-line border separates inner and outer rings.',
  },
  {
    id: 'banner_top',
    ui_label: 'Banner Top',
    ui_description: 'Ribbon banner at top, illustration fills below',
    thumbnail_path: 'thumbnails/spatial/banner_top.png',
    prompt_text:
      "Banner ribbon at the top of the canvas carrying the primary text inside it, with the illustration filling the lower two-thirds of the canvas and generous padding around it. The banner's tails curl slightly outward at the canvas edges.",
  },
  {
    id: 'headline_top_subtitle_bottom',
    ui_label: 'Headline + Subtitle',
    ui_description: 'Bold headline top, illustration center, small subtitle bottom',
    thumbnail_path: 'thumbnails/spatial/headline_top_subtitle_bottom.png',
    prompt_text:
      'Single bold headline anchored at the top edge, the illustration filling the center of the canvas with breathing room around it, and a smaller subtitle line anchored at the bottom edge. Strong top-bottom symmetry, generous vertical breathing room.',
  },
  {
    id: 'text_overlay',
    ui_label: 'Text Overlay',
    ui_description: 'Slogan rendered ON TOP of the illustration',
    thumbnail_path: 'thumbnails/spatial/text_overlay.png',
    prompt_text:
      'Overlay layout where the slogan text is rendered directly ON TOP of the centered illustration with a high-contrast outline or knockout stroke around each letter so the text stays fully legible against the artwork beneath it.',
  },
  // ─── Pure typographic layouts (text-only, no illustration) ──────────────
  {
    id: 'stacked_word_block',
    ui_label: 'Stacked Word Block',
    ui_description: '4–6 centered text lines, sizes vary, no illustration',
    thumbnail_path: 'thumbnails/spatial/stacked_word_block.png',
    prompt_text:
      'Pure typographic stacked-word block with 4 to 6 horizontally centered text lines of varying font sizes and weights, no illustration. The visual hierarchy makes the central emphasis word the largest, the framing lines smaller and lighter. Even vertical spacing between lines.',
  },
  {
    id: 'knockout_text',
    ui_label: 'Knockout Text',
    ui_description: 'Slogan cut out of a single solid shape',
    thumbnail_path: 'thumbnails/spatial/knockout_text.png',
    prompt_text:
      'Knockout reverse layout where the slogan text is cut out of a single solid filled shape — a rectangle, oval, or rounded plaque — so the canvas background shows through the letterforms. No separate illustration. The shape fills most of the canvas with even padding to the edges.',
  },
  {
    id: 'big_word_tiny_tag',
    ui_label: 'Big Word + Tiny Tag',
    ui_description: 'One huge word, tiny subtitle, no illustration',
    thumbnail_path: 'thumbnails/spatial/big_word_tiny_tag.png',
    prompt_text:
      'Single dominant word filling roughly two-thirds of the canvas in massive heavyweight type, with a small subtitle line in tiny all-caps anchored centered immediately beneath it. No separate illustration. The supporting line is one-tenth the size of the dominant word.',
  },
  {
    id: 'word_as_shape',
    ui_label: 'Word-as-Shape',
    ui_description: 'Text bent to form a silhouette (heart, animal, …)',
    thumbnail_path: 'thumbnails/spatial/word_as_shape.png',
    prompt_text:
      'Word-as-shape layout where the slogan text is bent, curved and arranged so the overall outline of the text block forms a recognizable silhouette — a heart, animal, or symbol related to the subject — without a separate illustration. The text itself IS the imagery.',
  },
  {
    id: 'diagonal_text',
    ui_label: 'Diagonal Text Block',
    ui_description: 'Slogan tilted 15–25° as a single rotated block',
    thumbnail_path: 'thumbnails/spatial/diagonal_text.png',
    prompt_text:
      'Diagonal text block tilted 15 to 25 degrees off horizontal, the slogan stacked into 2 or 3 lines and rotated together as a single unit. Illustration is either omitted or sits subtly behind the text as a low-contrast silhouette. The diagonal cuts across the visual center.',
  },
  {
    id: 'pyramid_stack',
    ui_label: 'Pyramid Stack',
    ui_description: 'Lines growing/shrinking in size, pyramid silhouette',
    thumbnail_path: 'thumbnails/spatial/pyramid_stack.png',
    prompt_text:
      'Pyramid word-stack layout with 4 to 5 stacked text lines forming a pyramid: the top line is shortest and smallest, each subsequent line wider and bolder, with the bottom line as the dominant emphasis word. No illustration. Tight vertical spacing for triangular cohesion.',
  },
  // ─── Frame / Stamp / Crest layouts ──────────────────────────────────────
  {
    id: 'rectangular_frame',
    ui_label: 'Rectangular Frame',
    ui_description: 'Thin border, illustration center, text above + below',
    thumbnail_path: 'thumbnails/spatial/rectangular_frame.png',
    prompt_text:
      'Rectangular frame layout with a thin border running around the canvas edge, the illustration centered inside the frame, and the slogan placed inside the frame above and below the illustration with generous interior padding. The frame has subtle ornamental corners.',
  },
  {
    id: 'crest_coat_of_arms',
    ui_label: 'Crest / Coat of Arms',
    ui_description: 'Heraldic vertical shield + banner + flanking elements',
    thumbnail_path: 'thumbnails/spatial/crest_coat_of_arms.png',
    prompt_text:
      'Vertical heraldic crest layout with the illustration at the visual center inside a shield outline, a flowing banner ribbon underneath carrying the slogan, and decorative laurel-leaf or wing motifs flanking the shield on left and right. Symmetric on the vertical axis.',
  },
  {
    id: 'postage_stamp',
    ui_label: 'Postage Stamp',
    ui_description: 'Perforated jagged border, denomination tag, framed',
    thumbnail_path: 'thumbnails/spatial/postage_stamp.png',
    prompt_text:
      'Postage-stamp layout with a perforated jagged-edge border around the canvas, a small denomination tag in one upper corner, the illustration filling the inner stamp area, and the slogan running along the bottom of the inner stamp frame. Visible perforation dots on all four edges.',
  },
  {
    id: 'hexagon_medallion',
    ui_label: 'Hexagon Medallion',
    ui_description: 'Hexagon or diamond outline, illustration inside',
    thumbnail_path: 'thumbnails/spatial/hexagon_medallion.png',
    prompt_text:
      'Hexagonal medallion layout with the illustration centered inside a sharp hexagon or diamond outline, the slogan placed above the medallion and an accent word below it. Sharp geometric border lines, no rounded corners, strict symmetry.',
  },
  {
    id: 'road_sign',
    ui_label: 'Road Sign / Placard',
    ui_description: 'Octagon / triangle / shield sign with legend',
    thumbnail_path: 'thumbnails/spatial/road_sign.png',
    prompt_text:
      'Road-sign placard layout shaped like an octagon, triangle, or highway-shield outline filling most of the canvas. The slogan is rendered as the sign legend in centered all-caps inside the sign shape. The illustration, if any, is small and tucked into one corner.',
  },
  // ─── Listing / definition / structured layouts ──────────────────────────
  {
    id: 'definition_entry',
    ui_label: 'Dictionary Definition',
    ui_description: 'Headword, phonetics, part-of-speech, paragraph',
    thumbnail_path: 'thumbnails/spatial/definition_entry.png',
    prompt_text:
      'Dictionary-definition layout with the headword in large bold at the top, a phonetic pronunciation guide in brackets plus a part-of-speech label on the second line, then a multi-line definition paragraph beneath set in a smaller serif. No separate illustration.',
  },
  {
    id: 'knolling_grid',
    ui_label: 'Knolling Grid',
    ui_description: '4–9 illustrated items in a tidy uniform grid + title bar',
    thumbnail_path: 'thumbnails/spatial/knolling_grid.png',
    prompt_text:
      'Knolling-grid layout with 4 to 9 small illustrated objects arranged in a tidy uniform grid (e.g. 3×3 or 3×2), each separated by equal padding, and a centered title bar across the top spanning the full grid width carrying the slogan.',
  },
  {
    id: 'anatomy_diagram',
    ui_label: 'Anatomy Diagram',
    ui_description: 'Central illustration with labeled pointer lines',
    thumbnail_path: 'thumbnails/spatial/anatomy_diagram.png',
    prompt_text:
      'Anatomy-diagram layout with the central illustration in the middle of the canvas, thin pointer lines radiating outward to small text labels at multiple cardinal positions around it, and the slogan or title placed at the very top of the canvas as a header.',
  },
  {
    id: 'checklist',
    ui_label: 'Checklist',
    ui_description: '4–6 stacked lines, each with a checkbox tick',
    thumbnail_path: 'thumbnails/spatial/checklist.png',
    prompt_text:
      'Vertical checklist layout with 4 to 6 stacked text lines, each preceded by a small checkbox or tick icon, a header line at the top carrying the title, generous line height between items, and no separate illustration. The list is centered horizontally on the canvas.',
  },
  {
    id: 'periodic_tile',
    ui_label: 'Periodic Element Tile',
    ui_description: 'Square tile, atomic-number style, symbol + name',
    thumbnail_path: 'thumbnails/spatial/periodic_tile.png',
    prompt_text:
      "Periodic-table element-tile layout with a single square tile centered on the canvas, an atomic-number-style small digit in the top-left corner of the tile, a large symbol or word in the tile's center, and a longer name underneath the symbol. No separate illustration.",
  },
  {
    id: 'recipe_card',
    ui_label: 'Recipe / Ingredients Card',
    ui_description: 'Title, subtitle, bulleted ingredient list',
    thumbnail_path: 'thumbnails/spatial/recipe_card.png',
    prompt_text:
      'Recipe-card layout with a headline title at the top, a small subtitle directly beneath, then an ingredients list of 4 to 6 short bulleted lines below, optionally a tiny garnish illustration anchored in one bottom corner. Even left alignment for the list, centered headline.',
  },
  // ─── Themed templates ───────────────────────────────────────────────────
  {
    id: 'vintage_postcard',
    ui_label: 'Vintage Postcard',
    ui_description: "'Greetings from …' headline + small caption",
    thumbnail_path: 'thumbnails/spatial/vintage_postcard.png',
    prompt_text:
      "Vintage-postcard layout with a 'Greetings from …' style phrase as the dominant headline filling the top half of the canvas in chunky stacked letters, a stylized illustration beneath the headline filling the lower half, and a small caption line at the very bottom.",
  },
  {
    id: 'sports_jersey',
    ui_label: 'Sports Jersey',
    ui_description: 'Massive number center, arched name + team name',
    thumbnail_path: 'thumbnails/spatial/sports_jersey.png',
    prompt_text:
      'Sports-jersey layout with a massive sports-style number filling the visual center of the canvas, a player-name-style word arched above the number, and a smaller team-name caption arched below the number. No separate illustration — the typography is the whole composition.',
  },
  {
    id: 'movie_poster',
    ui_label: 'Movie Poster',
    ui_description: 'Central illustration, heavy title bottom, credit block',
    thumbnail_path: 'thumbnails/spatial/movie_poster.png',
    prompt_text:
      'Movie-poster layout with the illustration filling the central two-thirds of the canvas, a dramatic title in heavyweight letters across the bottom third, and small credit-block lines tucked beneath the title. Vertical poster-aspect framing implied even on a square canvas.',
  },
  {
    id: 'license_plate',
    ui_label: 'License Plate',
    ui_description: 'Horizontal plate box with chunky plate letters',
    thumbnail_path: 'thumbnails/spatial/license_plate.png',
    prompt_text:
      'License-plate layout with a horizontal rectangular plate-shaped box filling the canvas center, the slogan rendered in chunky license-plate-style block letters inside the box, and small region or state tags positioned above and below the plate rectangle.',
  },
  {
    id: 'concert_ticket',
    ui_label: 'Concert Ticket',
    ui_description: 'Ticket shape with perforation + stub',
    thumbnail_path: 'thumbnails/spatial/concert_ticket.png',
    prompt_text:
      'Concert-ticket layout with a horizontal ticket-shape outline filling the canvas, dashed perforation lines running vertically to separate a stub from the main area, the headline event-name in the main ticket area, and small detail lines (date / time / seat) in the stub portion.',
  },
  {
    id: 'map_coordinates',
    ui_label: 'Map Coordinates',
    ui_description: 'Place name + GPS numbers + landmark line-art',
    thumbnail_path: 'thumbnails/spatial/map_coordinates.png',
    prompt_text:
      'Map-coordinates layout with a city or place name as the dominant headline at the top, GPS-style coordinate numbers in a smaller caption immediately below it, and a minimal-line-art illustration of a landmark or geographic outline anchored below the coordinates.',
  },
  // ─── Asymmetric / compositional layouts ─────────────────────────────────
  {
    id: 'off_center_text_wrap',
    ui_label: 'Off-Center Text Wrap',
    ui_description: 'Illustration on one side, text wraps its silhouette',
    thumbnail_path: 'thumbnails/spatial/off_center_text_wrap.png',
    prompt_text:
      'Off-center composition with the illustration anchored to the right side of the canvas and the slogan text broken into multiple short lines that wrap and follow the silhouette edge of the illustration on the left, creating a flowing left-side text block.',
  },
  {
    id: 'diagonal_split',
    ui_label: 'Diagonal Split',
    ui_description: 'Canvas split along a diagonal: illustration vs. text',
    thumbnail_path: 'thumbnails/spatial/diagonal_split.png',
    prompt_text:
      'Diagonal split layout where the canvas is divided into two triangular halves along a single diagonal line: the illustration fills one triangular half and the stacked slogan text fills the other triangular half. The diagonal line itself is a clean hard edge with no shading.',
  },
  {
    id: 'triptych_three_panel',
    ui_label: 'Triptych (3-Panel)',
    ui_description: 'Three vertical panels, each with a variant, header bar',
    thumbnail_path: 'thumbnails/spatial/triptych_three_panel.png',
    prompt_text:
      'Triptych three-panel layout with the canvas divided into three vertical panels of equal width separated by thin dividers, a small illustration variation in each panel, and the slogan running across as a header bar spanning all three panels at the top.',
  },
  {
    id: 'concentric_circular_text',
    ui_label: 'Concentric Circular Text',
    ui_description: 'Rings of text running around a center illustration',
    thumbnail_path: 'thumbnails/spatial/concentric_circular_text.png',
    prompt_text:
      'Concentric circular text layout with the illustration at the dead center of the canvas and one to three rings of text running around it: the outer ring as primary slogan, the inner ring as accent or date — all text aligned along its respective arc path.',
  },
  // ─── Speech / quote layouts ─────────────────────────────────────────────
  {
    id: 'speech_bubble',
    ui_label: 'Speech Bubble',
    ui_description: 'Comic bubble with slogan, character below pointing up',
    thumbnail_path: 'thumbnails/spatial/speech_bubble.png',
    prompt_text:
      'Comic speech-bubble layout with a rounded speech bubble in the upper half of the canvas holding the slogan inside it, and a small character illustration in the lower half from which the speech-bubble tail visually points. Classic comic-strip composition.',
  },
  {
    id: 'quote_marks_frame',
    ui_label: 'Quote Marks Frame',
    ui_description: 'Giant quotation marks bracket a centered slogan',
    thumbnail_path: 'thumbnails/spatial/quote_marks_frame.png',
    prompt_text:
      'Quote-marks frame layout with two giant decorative quotation marks anchoring the upper-left and lower-right corners of the canvas, the slogan centered between them in an italic style. No separate illustration — the typography and the marks are the whole composition.',
  },
  // ─── Sunburst layout (full composition, distinct from sunburst accessory) ──
  {
    id: 'sunburst_layout',
    ui_label: 'Sunburst Layout',
    ui_description: 'Center illustration, rays to edges, text on arcs',
    thumbnail_path: 'thumbnails/spatial/sunburst_layout.png',
    prompt_text:
      'Sunburst layout with the illustration sitting at the dead center of the canvas and straight ray lines radiating outward from behind it to the canvas edges, the slogan text running along the top arc above the rays and a secondary tag along the bottom arc beneath.',
  },
] as const;

// J.5 — Text Segmentation (slot key: text_segmentation)
export const TEXT_SEGMENTATION_OPTIONS: readonly string[] = [
  'a single centered slogan rendered as one block of text',
  'the slogan split in half, first half on top and second half on the bottom of the design',
  'a primary headline followed by a smaller subtitle line beneath it',
  'a three-line stacked block where the middle line is the largest emphasis word',
  'the slogan placed on a banner ribbon with one accent word sitting outside the ribbon',
  'two-tone segmentation where the dominant nouns are in one color/style and the connecting words in another',
] as const;

// J.6 — Typography Adjectives (slot key: typography_adjectives).
// Each variant is wrapped in single-quotes inside the string so it slots into
// the Architect template "The text is rendered in a {value} font style." cleanly.
export const TYPOGRAPHY_OPTIONS: readonly string[] = [
  "'massive heavyweight cartoon-block font with sharp rounded corners and internal white gloss lines'",
  "'thin casual hand-drawn marker font with slightly irregular wobble and rough ink-bleed edges'",
  "'chunky distressed varsity-collegiate serif with a heavyweight slab base and weathered worn-in texture'",
  "'ornate medieval blackletter font with decorative flourishes, dramatic thick-thin contrast and gothic terminals'",
  "'pixelated 8-bit monospace bitmap font with sharp uniform pixels and zero anti-aliasing'",
  "'elegant brush-script handwriting font with thick-thin contrast, ligatures and a confident calligraphic flow'",
] as const;

// J.7 — Accessories (slot key: accessories) — multi-select on the frontend.
export const ACCESSORIES_OPTIONS: readonly string[] = [
  'white radiating motion-burst lines around the illustration',
  'a sparse scattering of small filled stars and tiny dots framing the design',
  'a thin geometric border frame enclosing the entire composition',
  'a curved banner ribbon underneath the illustration with secondary text on it',
  'sunburst rays radiating outward from behind the illustration',
  'halftone-dot accents in the negative space around the illustration',
] as const;

// J.8 — Material / Texture (slot key: material_texture).
export const MATERIAL_OPTIONS: readonly string[] = [
  'clean digital vector with flat color regions and crisp hard edges',
  'matte screenprint plastisol ink texture with subtle paper-grain underlay',
  'heavily distressed and weathered ink-bleed texture with cracked color fills',
  'halftone-dot color fills with classic comic-book printing aesthetic and a limited 2-3 color palette',
  'gritty vintage worn-on-fabric look with faded color washes and ink-loss patches',
  'high-contrast 2-color screenprint with bold blocky color regions and hand-cut stencil edges',
] as const;

/** O(1) lookup helper — returns the `SpatialOption` whose `id` matches, or `undefined`. */
export const getSpatialById = (id: string): SpatialOption | undefined =>
  SPATIAL_OPTIONS.find((entry) => entry.id === id);

/**
 * Heuristic: a value that looks like a UUID v4 (8-4-4-4-12 hex with dashes).
 * Used by SpatialSlotButton to decide whether to render the "Custom layout"
 * variant (UUID points at a `CustomSpatial` row owned by the workspace) vs
 * the raw-text variant.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSpatialUuid = (value: string): boolean => UUID_RE.test(value);

// PROJ-34 Phase 7 — frontend mirror of design_app.services.style_library.STYLE_LIBRARY.
// Source of truth for the StylePicker UI: 15 flat entries (no nested "More" modal per AC-22).
// If an entry is added or removed here it MUST also be mirrored in the backend file.
//
// PROJ-34 Phase 13j: typography defaults moved from `TYPOGRAPHY_OPTIONS[i]` (raw
// strings, v1 shape) to `getTypographyById(id).prompt_text` (id-resolved from the
// new 21-entry dict list, Appendix K). `defaultTypography` continues to hold the
// raw `prompt_text` so the TypographyPicker `value === styleDefault` equality
// check keeps working without any callsite changes.

import { getTypographyById } from './slotOptions'

const typoText = (id: string): string => {
  const entry = getTypographyById(id)
  if (!entry) {
    throw new Error(
      `styleLibrary.ts: unknown typography id "${id}" — Appendix K mapping drift`,
    )
  }
  return entry.prompt_text
}

export interface StyleEntry {
  slug: string
  label: string
  shortDescription: string
  thumbnail: string
  promptSuffix: string
  // PROJ-34 Phase 13a (Appendix K) — auto-defaults for the form-based Builder.
  // Phase 13j: `defaultTypography` is the resolved `prompt_text` of the style's
  // `default_typography_id`. The id mapping lives below per row.
  defaultTypography: string
}

const THUMB = (slug: string) => `/style-thumbnails/${slug}.png`

export const STYLE_LIBRARY: StyleEntry[] = [
  {
    slug: 'vintage_retro',
    label: 'Vintage Retro',
    shortDescription: 'Warm faded tones, thick outlines, distressed grain',
    thumbnail: THUMB('vintage_retro'),
    promptSuffix:
      'Vintage retro aesthetic with warm faded earth tones (mustard yellow, burnt orange, dusty teal, cream), thick uniform black outlines, slightly distressed grain texture overlay, halftone shading on flat color fills, weathered screen-print feel',
    defaultTypography: typoText('distressed_vintage_slab'),
  },
  {
    slug: '70s_groovy',
    label: '70s Groovy',
    shortDescription: 'Earthy psychedelic palette, flowing curves',
    thumbnail: THUMB('70s_groovy'),
    promptSuffix:
      '1970s groovy psychedelic vibe with bold flowing curved typography, earthy palette of mustard, burnt orange, olive, cream and rust, thick black outlines, soft halftone dot accents, retro disco poster aesthetic',
    defaultTypography: typoText('seventies_groovy_bold'),
  },
  {
    slug: '80s_neon',
    label: '80s Neon Synthwave',
    shortDescription: 'Hot magenta + cyan + chrome glow',
    thumbnail: THUMB('80s_neon'),
    promptSuffix:
      '1980s neon synthwave aesthetic with hot magenta, electric cyan, vibrant purple and matte black, chrome reflective typography, vaporwave grid background motifs, glowing neon outlines, retro arcade vibe',
    defaultTypography: typoText('chrome_bevel_display'),
  },
  {
    slug: '90s_grunge',
    label: '90s Grunge',
    shortDescription: 'Distressed ink-bleed, faded high-contrast',
    thumbnail: THUMB('90s_grunge'),
    promptSuffix:
      '1990s grunge style with distressed ink-bleed textures, faded high-contrast palette of worn black, cream and faded red, torn-edge effects, gritty rough outlines, photocopy-worn screen-print look',
    defaultTypography: typoText('distressed_industrial_sans'),
  },
  {
    slug: 'kawaii_chibi',
    label: 'Kawaii Chibi',
    shortDescription: 'Cute oversized heads, sparkly eyes, pastels',
    thumbnail: THUMB('kawaii_chibi'),
    promptSuffix:
      'Kawaii chibi cartoon style with oversized cute heads, big sparkly black eyes with white highlights, soft pastel palette (baby pink, mint, lavender, butter yellow), thick rounded outlines, gentle pastel cell-shading, adorable expression',
    defaultTypography: typoText('childlike_rounded_block'),
  },
  {
    slug: 'cartoon',
    label: 'Cartoon',
    shortDescription: 'Thick outlines, flat fills, playful shapes',
    thumbnail: THUMB('cartoon'),
    promptSuffix:
      'Bold cartoon style with thick uniform black outlines, flat saturated color fills, simple cel-shaded highlights, expressive exaggerated features, playful vibrant palette, Saturday-morning animation aesthetic',
    defaultTypography: typoText('chunky_cartoon_block_gloss'),
  },
  {
    slug: 'watercolor',
    label: 'Watercolor',
    shortDescription: 'Soft transparent washes, organic edges',
    thumbnail: THUMB('watercolor'),
    promptSuffix:
      'Watercolor illustration style with soft transparent color washes, irregular pigment edges, visible paper texture, organic flowing brush strokes, layered translucent pigment, hand-painted artisan feel',
    defaultTypography: typoText('modern_elegant_brush'),
  },
  {
    slug: 'hand_drawn_sketch',
    label: 'Hand-Drawn Sketch',
    shortDescription: 'Loose pencil strokes, imperfect linework',
    thumbnail: THUMB('hand_drawn_sketch'),
    promptSuffix:
      'Hand-drawn sketch style with loose pencil and pen strokes, visible construction lines, slightly imperfect organic linework, monochrome or muted color accents, charming sketchbook journal aesthetic',
    defaultTypography: typoText('playful_marker_script'),
  },
  {
    slug: 'vector_flat',
    label: 'Vector Flat',
    shortDescription: 'Clean modern flat shapes, no gradients',
    thumbnail: THUMB('vector_flat'),
    promptSuffix:
      'Clean modern flat vector style with geometric shapes, zero gradients, smart minimalist palette, crisp sharp edges, contemporary commercial design aesthetic, editorial Apple-emoji flatness',
    defaultTypography: typoText('minimal_geometric_sans'),
  },
  {
    slug: 'minimal_line_art',
    label: 'Minimal Line Art',
    shortDescription: 'Single-line monoline, lots of negative space',
    thumbnail: THUMB('minimal_line_art'),
    promptSuffix:
      'Minimal single-line illustration with consistent monoline weight, no fills, no shading, elegant continuous lines, abundant negative space, refined editorial wordmark aesthetic',
    defaultTypography: typoText('minimal_geometric_sans'),
  },
  {
    slug: 'pixel_art',
    label: 'Pixel Art',
    shortDescription: '8-bit pixelated, 16-color retro palette',
    thumbnail: THUMB('pixel_art'),
    promptSuffix:
      'Pixel art 8-bit gaming style with sharp pixelated edges, no anti-aliasing, limited 16-color retro arcade palette, blocky uniform pixels, nostalgic NES/Game Boy aesthetic',
    defaultTypography: typoText('pixel_eight_bit_bitmap'),
  },
  {
    slug: 'distressed_texture',
    label: 'Distressed Texture',
    shortDescription: 'Worn ink, scratched fills, screenprint roughness',
    thumbnail: THUMB('distressed_texture'),
    promptSuffix:
      'Heavily distressed print texture with worn ink-bleed effect, scratched and cracked color fills, vintage screen-print roughness, aged-on-fabric look, rough rustic typography',
    defaultTypography: typoText('tattoo_old_school_bold'),
  },
  {
    slug: 'halftone_print',
    label: 'Halftone Print',
    shortDescription: 'Dot-pattern fills, comic book look',
    thumbnail: THUMB('halftone_print'),
    promptSuffix:
      'Halftone print style with dot-pattern color fills (varying dot sizes), classic comic-book printing aesthetic, limited 2-3 color palette, retro newsprint feel, pop-art flatness',
    defaultTypography: typoText('retro_diner_brush'),
  },
  {
    slug: 'badge_emblem',
    label: 'Badge / Emblem',
    shortDescription: 'Circular emblem, banner ribbons, heritage crest',
    thumbnail: THUMB('badge_emblem'),
    promptSuffix:
      'Vintage badge emblem layout with circular or shield-shaped border, banner ribbons above and below, central crest illustration, classic monochrome or 2-color palette, heritage trade-mark feel',
    defaultTypography: typoText('varsity_script_swash'),
  },
  {
    slug: 'blackletter_gothic',
    label: 'Blackletter Gothic',
    shortDescription: 'Heavy medieval typography, dark mood',
    thumbnail: THUMB('blackletter_gothic'),
    promptSuffix:
      'Heavy blackletter gothic typography with ornate medieval scripts, dramatic high-contrast strokes, decorative flourishes, dark moody palette, often paired with skull / raven / cross / banner motifs',
    defaultTypography: typoText('blackletter_gothic'),
  },
  {
    slug: 'comic_book',
    label: 'Comic Book',
    shortDescription: 'Bold ink outlines, action-lines, flat saturated fills',
    thumbnail: THUMB('comic_book'),
    promptSuffix:
      'Classic American comic-book aesthetic with bold uniform black ink outlines around every shape, flat saturated single-color fills with NO cel-shading and NO halftone-dot shading, hand-inked organic line weight variation, action-line accents (motion-bursts, impact-rays, speed-streaks) where energy is implied, vibrant primary-color palette (red / yellow / blue accents on a flat background), Marvel/DC superhero feel stripped of chiaroscuro shading',
    defaultTypography: typoText('chunky_cartoon_block_gloss'),
  },
]

/** O(1) lookup helper — returns the StyleEntry whose `slug` matches, or `undefined`. */
export const getStyleBySlug = (slug: string): StyleEntry | undefined =>
  STYLE_LIBRARY.find((entry) => entry.slug === slug)

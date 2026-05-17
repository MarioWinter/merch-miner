"""PROJ-34 — backend mirror of the 15-style frontend library (Appendix E).

The frontend ships `frontend-ui/src/views/designs/board/constants/styleLibrary.ts`
with the same 15 entries; this module is the backend source of truth for
slug → label / promptSuffix lookup used by `build_architect_prompt`.

If a future entry is added it must be mirrored in both files.
"""

from __future__ import annotations

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
    },
    'minimal_line_art': {
        'label': 'Minimal Line Art',
        'short_description': 'Single-line monoline, lots of negative space',
        'prompt_suffix': (
            'Minimal single-line illustration with consistent monoline weight, '
            'no fills, no shading, elegant continuous lines, abundant negative '
            'space, refined editorial wordmark aesthetic'
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
    },
    'distressed_texture': {
        'label': 'Distressed Texture',
        'short_description': 'Worn ink, scratched fills, screenprint roughness',
        'prompt_suffix': (
            'Heavily distressed print texture with worn ink-bleed effect, '
            'scratched and cracked color fills, vintage screen-print '
            'roughness, aged-on-fabric look, rough rustic typography'
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
    },
    'badge_emblem': {
        'label': 'Badge / Emblem',
        'short_description': 'Circular emblem, banner ribbons, heritage crest',
        'prompt_suffix': (
            'Vintage badge emblem layout with circular or shield-shaped border, '
            'banner ribbons above and below, central crest illustration, '
            'classic monochrome or 2-color palette, heritage trade-mark feel'
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

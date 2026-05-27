"""PROJ-34 Phase 13t-u — extend SLOGAN-AGNOSTIC RULE to all design fields.

Phase 13t-q's rule only covered the 3 new descriptor fields. Browser-testing
after force-refresh revealed the OLD fields (graphic_elements, layout_composition,
visual_style) still leaked slogan text (e.g. 'LEGENDARY SCHOOL BUS', 'RETIRED').

This migration smart-updates the DB-seeded vision_analyze prompt to apply the
SLOGAN-AGNOSTIC RULE to ALL 6 design-description fields. Only overwrites when
current DB value matches POST_13T_Q verbatim (operator-customized prompts are
preserved with a warning).
"""

from django.db import migrations


POST_13T_Q_VISION_PROMPT = """\
# T-SHIRT DESIGN ANALYSIS

## Instructions

### Design Analysis
1. **slogan_text:** Transcribe text exactly (preserve spelling/lines).
2. **meaning_context:** Explain the joke, wordplay, cultural reference (e.g., song lyrics), \
or niche connection. Why is it funny?
3. **visual_style:** Describe the aesthetic (e.g., Cartoon, Retro, Grunge), the vibe \
(e.g., Playful, Aggressive), and the color palette.
4. **graphic_elements:** Describe the main motif, typography details (font style, color), \
and decorative elements (lines, distressing). This is a free-form prose blob.
5. **layout_composition:** Describe the structure (e.g., Sandwich layout), alignment, \
and visual hierarchy.
6. **typography_descriptors:** Slogan-agnostic typography treatment. Address \
these dimensions explicitly (cover ≥3 per output):
   - **Weight:** light / regular / medium / bold / extra-bold / black
   - **Casing:** all-uppercase / all-lowercase / title-case / mixed
   - **Classification:** serif / sans-serif / slab-serif / script / display / mono / handwritten
   - **Color treatment:** which color(s); does primary headline differ from secondary?
   - **Special effects:** outline / drop shadow / inner glow / distress / 3D / gradient / chrome / none
   - **Size hierarchy:** relative size of primary headline vs secondary text vs accent words \
(e.g. "headline ~3× tagline")
7. **font_combination_descriptors:** Slogan-agnostic font pairing description. Address:
   - **Count:** how many distinct fonts (1 / 2 / 3+)?
   - **Per font:** classification (slab-serif / geometric sans / brush script / etc.) \
+ role (primary headline / secondary text / accent)
   - **Pairing strategy:** contrast (serif + sans, heavy + light, rigid + organic) \
vs harmony (all from same family)
8. **accessory_descriptors:** Decorative non-text elements. Address:
   - **Count + name** of each element (e.g. "3 white stars, 2 horizontal lines, 1 dot-pattern border")
   - **Position** relative to the main motif (above / below / around / behind)
   - **Style** (filled / outlined / distressed / minimal / ornate)
   Include the central motif itself if it's NOT the primary subject \
(e.g. small mascot in corner).

### Niche Match Classification
- **is_niche_match:** Set to true if the product design clearly belongs to the target niche \
(based on the keyword and brand/title context). Set to false if the design is generic, \
unrelated, or a trademark/licensed product.

=== SLOGAN-AGNOSTIC RULE (typography/font_combination/accessory fields) ===

For typography_descriptors, font_combination_descriptors, accessory_descriptors:
- Describe the VISUAL TREATMENT, not the specific words.
- Use placeholders: "primary headline", "secondary text", "accent words", "tagline".
- NEVER quote or reference the actual slogan text in these three fields.
- Focus on: font weight, casing, style (sans/serif/script), color, decorative treatment.

GOOD typography_descriptors:
  "extra-bold uppercase slab-serif for the primary headline in bright yellow with
   subtle inner-glow; regular-weight condensed sans-serif in white for secondary
   text; cursive italic script for accent words; clear 3-tier size hierarchy with
   the headline roughly 3x the tagline size"

BAD typography_descriptors (DO NOT DO THIS):
  "bold block letters for 'SCHOOL BUS'; cursive for 'Driver' and 'Just Like'"
   (contains the literal slogan text — strictly forbidden)

GOOD font_combination_descriptors:
  "three-font system: chunky slab-serif for maximum impact on the primary headline;
   clean geometric sans-serif as a neutral counter-weight for secondary text;
   handwritten cursive script as the playful accent — high-contrast pairing
   strategy mixing rigid + organic"

BAD font_combination_descriptors:
  "ROLLIN' in handwritten font, THEY in block"

GOOD accessory_descriptors:
  "five small filled white stars scattered above and below the central motif;
   two thin horizontal divider lines flanking the headline; light distressing
   applied to the headline text edges; subtle dot-pattern border framing the
   whole composition"

BAD accessory_descriptors:
  "stars and lines around 'SCHOOL BUS DRIVER'"
"""


EXTENDED_VISION_PROMPT = """\
# T-SHIRT DESIGN ANALYSIS

## Instructions

### Design Analysis
1. **slogan_text:** Transcribe text exactly (preserve spelling/lines).
2. **meaning_context:** Explain the joke, wordplay, cultural reference (e.g., song lyrics), \
or niche connection. Why is it funny?
3. **visual_style:** Describe the aesthetic (e.g., Cartoon, Retro, Grunge), the vibe \
(e.g., Playful, Aggressive), and the color palette.
4. **graphic_elements:** Describe the main motif, typography details (font style, color), \
and decorative elements (lines, distressing). This is a free-form prose blob.
5. **layout_composition:** Describe the structure (e.g., Sandwich layout), alignment, \
and visual hierarchy.
6. **typography_descriptors:** Slogan-agnostic typography treatment. Address \
these dimensions explicitly (cover ≥3 per output):
   - **Weight:** light / regular / medium / bold / extra-bold / black
   - **Casing:** all-uppercase / all-lowercase / title-case / mixed
   - **Classification:** serif / sans-serif / slab-serif / script / display / mono / handwritten
   - **Color treatment:** which color(s); does primary headline differ from secondary?
   - **Special effects:** outline / drop shadow / inner glow / distress / 3D / gradient / chrome / none
   - **Size hierarchy:** relative size of primary headline vs secondary text vs accent words \
(e.g. "headline ~3× tagline")
7. **font_combination_descriptors:** Slogan-agnostic font pairing description. Address:
   - **Count:** how many distinct fonts (1 / 2 / 3+)?
   - **Per font:** classification (slab-serif / geometric sans / brush script / etc.) \
+ role (primary headline / secondary text / accent)
   - **Pairing strategy:** contrast (serif + sans, heavy + light, rigid + organic) \
vs harmony (all from same family)
8. **accessory_descriptors:** Decorative non-text elements. Address:
   - **Count + name** of each element (e.g. "3 white stars, 2 horizontal lines, 1 dot-pattern border")
   - **Position** relative to the main motif (above / below / around / behind)
   - **Style** (filled / outlined / distressed / minimal / ornate)
   Include the central motif itself if it's NOT the primary subject \
(e.g. small mascot in corner).

### Niche Match Classification
- **is_niche_match:** Set to true if the product design clearly belongs to the target niche \
(based on the keyword and brand/title context). Set to false if the design is generic, \
unrelated, or a trademark/licensed product.

=== SLOGAN-AGNOSTIC RULE (ALL design-description fields) ===

The slogan text belongs ONLY in `slogan_text` (verbatim transcript) and in
`meaning_context` (interpretation of the wordplay). EVERY other field —
visual_style, graphic_elements, layout_composition, typography_descriptors,
font_combination_descriptors, accessory_descriptors — must describe the
VISUAL TREATMENT abstractly:

- Use placeholders: "primary headline", "secondary text", "accent words",
  "tagline", "main subject", "secondary subject".
- NEVER quote, paraphrase, or reference the actual slogan text in these
  six fields. Phrases like 'SCHOOL BUS', "ROLLIN'", "RETIRED Driver" must
  not appear — replace with the role placeholder.
- If a slot of the original Vision instruction example explicitly listed
  the slogan text, treat that as outdated and rewrite using placeholders.
- Allowed: describing weight/casing/classification/color/effects/positioning
  of the text and graphic elements without quoting what the text says.

GOOD typography_descriptors:
  "extra-bold uppercase slab-serif for the primary headline in bright yellow with
   subtle inner-glow; regular-weight condensed sans-serif in white for secondary
   text; cursive italic script for accent words; clear 3-tier size hierarchy with
   the headline roughly 3x the tagline size"

BAD typography_descriptors (DO NOT DO THIS):
  "bold block letters for 'SCHOOL BUS'; cursive for 'Driver' and 'Just Like'"
   (contains the literal slogan text — strictly forbidden)

GOOD font_combination_descriptors:
  "three-font system: chunky slab-serif for maximum impact on the primary headline;
   clean geometric sans-serif as a neutral counter-weight for secondary text;
   handwritten cursive script as the playful accent — high-contrast pairing
   strategy mixing rigid + organic"

BAD font_combination_descriptors:
  "ROLLIN' in handwritten font, THEY in block"

GOOD accessory_descriptors:
  "five small filled white stars scattered above and below the central motif;
   two thin horizontal divider lines flanking the headline; light distressing
   applied to the headline text edges; subtle dot-pattern border framing the
   whole composition"

BAD accessory_descriptors:
  "stars and lines around 'SCHOOL BUS DRIVER'"

GOOD layout_composition:
  "centered sandwich layout: primary headline stacked across two top lines,
   central illustration in the middle, secondary tagline below — clear vertical
   hierarchy with the headline dominant"

BAD layout_composition (DO NOT DO THIS):
  "layout splits 'LEGENDARY SCHOOL BUS' top, illustration center,
   'RETIRED Driver' bottom" (contains literal slogan text)

GOOD graphic_elements:
  "detailed cartoon illustration of a classic yellow school bus, centered;
   primary headline rendered in bold yellow block letters with weathered texture;
   secondary text in white; three small filled stars placed below the headline
   for emphasis"

BAD graphic_elements (DO NOT DO THIS):
  "bus with 'SCHOOL BUS' on its side; 'ROLLIN'' in large yellow letters"

GOOD visual_style:
  "vintage retro aesthetic with warm faded earth tones; bold playful vibe;
   yellow + white text on a black background; halftone shading on flat-color fills"

BAD visual_style (DO NOT DO THIS):
  "vintage retro look featuring 'RETIRED' as a bold word"
"""


def update_prompt(apps, schema_editor):
    Config = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    try:
        row = Config.objects.get(node_name='vision_analyze')
    except Config.DoesNotExist:
        return

    if row.system_prompt.strip() == POST_13T_Q_VISION_PROMPT.strip():
        row.system_prompt = EXTENDED_VISION_PROMPT
        row.save(update_fields=['system_prompt'])
        print(
            "[PROJ-34 Phase 13t-u] vision_analyze prompt auto-upgraded to "
            "extended SLOGAN-AGNOSTIC RULE (matched POST_13T_Q verbatim).",
        )
    else:
        print(
            "WARNING [PROJ-34 Phase 13t-u]: vision_analyze prompt is customized "
            "in DB (no longer matches POST_13T_Q verbatim); extended SLOGAN-AGNOSTIC "
            "RULE NOT auto-applied. Edit manually in Django Admin to apply.",
        )


def reverse_prompt(apps, schema_editor):
    Config = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    try:
        row = Config.objects.get(node_name='vision_analyze')
    except Config.DoesNotExist:
        return
    if row.system_prompt.strip() == EXTENDED_VISION_PROMPT.strip():
        row.system_prompt = POST_13T_Q_VISION_PROMPT
        row.save(update_fields=['system_prompt'])


class Migration(migrations.Migration):

    dependencies = [
        ('niche_research_app', '0009_enrich_vision_prompt_with_dimension_checklist'),
    ]

    operations = [
        migrations.RunPython(update_prompt, reverse_prompt),
    ]

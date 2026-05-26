"""Smart-update DB-seeded vision_analyze prompt with enriched dimensions checklist.

PROJ-34 Phase 13t-q: enriches the per-field instructions for typography,
font_combination, and accessory descriptors with explicit dimensions checklists
+ richer GOOD examples. Smart-update: only overwrites the DB row if the current
value matches the POST_13T_P verbatim (= unchanged after migration 0008).

See features/PROJ-34-design-prompt-engineering.md AC-142 + EC-54.
"""

from django.db import migrations


POST_13T_P_VISION_PROMPT = """\
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
6. **typography_descriptors:** Slogan-agnostic typography treatment (see Slogan-Agnostic Rule below).
7. **font_combination_descriptors:** Slogan-agnostic font pairing description.
8. **accessory_descriptors:** Decorative elements (stars, lines, borders, distressing) — \
slogan-agnostic.

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
  "bold uppercase block letters for the primary headline; cursive script font for
   the secondary text and accent words; high contrast between weights"

BAD typography_descriptors (DO NOT DO THIS):
  "bold block letters for 'SCHOOL BUS'; cursive for 'Driver' and 'Just Like'"
   (contains the literal slogan text — strictly forbidden)

GOOD font_combination_descriptors:
  "Sans-serif uppercase paired with a handwritten cursive script accent"

BAD font_combination_descriptors:
  "ROLLIN' in handwritten font, THEY in block"

GOOD accessory_descriptors:
  "white stars and decorative lines arranged around the central motif;
   subtle distressing on the headline; small dot-pattern border"

BAD accessory_descriptors:
  "stars and lines around 'SCHOOL BUS DRIVER'"
"""


ENRICHED_VISION_PROMPT = """\
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


def update_prompt(apps, schema_editor):
    """Smart-update: overwrite only if current DB value matches POST_13T_P verbatim."""
    Config = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    try:
        row = Config.objects.get(node_name='vision_analyze')
    except Config.DoesNotExist:
        return

    if row.system_prompt.strip() == POST_13T_P_VISION_PROMPT.strip():
        row.system_prompt = ENRICHED_VISION_PROMPT
        row.save(update_fields=['system_prompt'])
        print(
            "[PROJ-34 Phase 13t-q] vision_analyze prompt auto-upgraded to "
            "enriched dimensions checklist (matched POST_13T_P verbatim).",
        )
    else:
        print(
            "WARNING [PROJ-34 Phase 13t-q]: vision_analyze prompt is customized "
            "in DB (no longer matches POST_13T_P verbatim); enriched dimensions "
            "checklist NOT auto-applied. Edit manually in Django Admin "
            "(/admin/niche_research_app/researchnodeconfig/) — copy block from "
            "features/PROJ-34-design-prompt-engineering.md Appendix AA.",
        )


def reverse_prompt(apps, schema_editor):
    """Reverse: revert to POST_13T_P only if current value matches ENRICHED verbatim."""
    Config = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    try:
        row = Config.objects.get(node_name='vision_analyze')
    except Config.DoesNotExist:
        return

    if row.system_prompt.strip() == ENRICHED_VISION_PROMPT.strip():
        row.system_prompt = POST_13T_P_VISION_PROMPT
        row.save(update_fields=['system_prompt'])


class Migration(migrations.Migration):

    dependencies = [
        ('niche_research_app', '0008_update_vision_prompt_for_descriptors'),
    ]

    operations = [
        migrations.RunPython(update_prompt, reverse_prompt),
    ]

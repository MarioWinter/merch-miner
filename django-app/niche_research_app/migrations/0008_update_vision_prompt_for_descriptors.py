"""Smart-update DB-seeded vision_analyze prompt for PROJ-34 Phase 13t-p.

Migration 0002 seeded every install with `DEFAULT_VISION_PROMPT` into
`ResearchNodeConfig.system_prompt`. The LLM client reads the DB value before
the code default, so code-only changes to the constant are wirkungslos on any
deployed system.

This migration upgrades the DB row ONLY when its content matches the OLD
default verbatim (= untouched seed). When the operator has customized the
prompt via Django Admin, the row is left untouched and a warning is logged.

See `features/PROJ-34-design-prompt-engineering.md` Phase 13t-p AC-131.5,
EC-52, EC-52.5 + `docs/tasks/PROJ-34-tasks.md` Appendix Z.
"""

from django.db import migrations


OLD_VISION_PROMPT = """\
# T-SHIRT DESIGN ANALYSIS

## Instructions

### Design Analysis
1. **slogan_text:** Transcribe text exactly (preserve spelling/lines).
2. **meaning_context:** Explain the joke, wordplay, cultural reference (e.g., song lyrics), \
or niche connection. Why is it funny?
3. **visual_style:** Describe the aesthetic (e.g., Cartoon, Retro, Grunge), the vibe \
(e.g., Playful, Aggressive), and the color palette.
4. **graphic_elements:** Describe the main motif, typography details (font style, color), \
and decorative elements (lines, distressing).
5. **layout_composition:** Describe the structure (e.g., Sandwich layout), alignment, \
and visual hierarchy.

### Niche Match Classification
- **is_niche_match:** Set to true if the product design clearly belongs to the target niche \
(based on the keyword and brand/title context). Set to false if the design is generic, \
unrelated, or a trademark/licensed product.
"""


NEW_VISION_PROMPT = """\
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


def update_prompt(apps, schema_editor):
    """Smart-update: overwrite only if current DB value matches OLD verbatim."""
    Config = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    try:
        row = Config.objects.get(node_name='vision_analyze')
    except Config.DoesNotExist:
        return

    if row.system_prompt.strip() == OLD_VISION_PROMPT.strip():
        row.system_prompt = NEW_VISION_PROMPT
        row.save(update_fields=['system_prompt'])
        print(
            "[PROJ-34 Phase 13t-p] vision_analyze prompt auto-upgraded "
            "(matched OLD default verbatim).",
        )
    else:
        print(
            "WARNING [PROJ-34 Phase 13t-p]: vision_analyze prompt is customized "
            "in DB; new SLOGAN-AGNOSTIC RULE block NOT auto-applied. "
            "Edit manually in Django Admin (/admin/niche_research_app/researchnodeconfig/) "
            "to enable the 3 new fields (typography_descriptors, "
            "font_combination_descriptors, accessory_descriptors).",
        )


def reverse_prompt(apps, schema_editor):
    """Reverse: revert to OLD only if current DB value matches NEW verbatim."""
    Config = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    try:
        row = Config.objects.get(node_name='vision_analyze')
    except Config.DoesNotExist:
        return

    if row.system_prompt.strip() == NEW_VISION_PROMPT.strip():
        row.system_prompt = OLD_VISION_PROMPT
        row.save(update_fields=['system_prompt'])


class Migration(migrations.Migration):

    dependencies = [
        ('niche_research_app', '0007_vision_structured_descriptors'),
    ]

    operations = [
        migrations.RunPython(update_prompt, reverse_prompt),
    ]

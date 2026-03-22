"""Pydantic schemas for LLM structured output (with_structured_output)."""

from enum import Enum

from pydantic import BaseModel, Field


class EmotionalPattern(str, Enum):
    """The 16 predefined emotional patterns for POD niche analysis."""

    IDENTITY_DECLARATION = "IDENTITY DECLARATION"
    GROUP_LEADER = "GROUP LEADER"
    TRIBE_COMMUNITY = "TRIBE/COMMUNITY"
    FUNNY_ACTIVITY = "FUNNY ACTIVITY"
    CROSS_NICHE_EVENTS = "CROSS-NICHE EVENTS"
    CROSS_NICHE_MASHUP = "CROSS-NICHE MASHUP"
    ADDICTION_OBSESSION = "ADDICTION/OBSESSION"
    VINTAGE_LEGACY = "VINTAGE/LEGACY"
    ACHIEVEMENT_GAMIFIED = "ACHIEVEMENT/GAMIFIED"
    JOB_PROFESSION_PARODY = "JOB/PROFESSION PARODY"
    RELATIONSHIP_HUMOR = "RELATIONSHIP HUMOR"
    BOUNDARY_GATEKEEPING = "BOUNDARY/GATEKEEPING"
    ENDURANCE_SURVIVAL = "ENDURANCE/SURVIVAL"
    COMPETENCE_EXPERTISE = "COMPETENCE/EXPERTISE"
    CHAOS_CONTROL = "CHAOS/CONTROL"
    SELF_CARE_PRIORITIES = "SELF-CARE/PRIORITIES"


# ---------- Vision Analysis ----------

class VisionAnalysisSchema(BaseModel):
    """Structured output from vision LLM analyzing a t-shirt thumbnail."""

    slogan_text: str = Field(
        description="Transcribe text exactly as it appears on the shirt (preserve spelling/lines).",
    )
    meaning_context: str = Field(
        description="Explain the joke, wordplay, cultural reference, or niche connection.",
    )
    visual_style: str = Field(
        description="Aesthetic description (e.g. Cartoon, Retro, Grunge), vibe, and color palette.",
    )
    graphic_elements: str = Field(
        description="Main motif, typography details (font style, color), and decorative elements.",
    )
    layout_composition: str = Field(
        description="Structure (e.g. Sandwich layout), alignment, and visual hierarchy.",
    )
    is_niche_match: bool = Field(
        description="True if the product design clearly belongs to the target niche.",
    )


# ---------- Emotional Analysis ----------

class CustomerPsychology(BaseModel):
    buyer_profile: str = Field(description="Description of buyer reality.")
    emotional_need: str = Field(description="The specific emotional itch this scratches.")
    internal_monologue: str = Field(description="First-person voice (2-3 sentences).")
    what_they_cant_say_out_loud: str = Field(description="The unspoken truth.")


class SentimentAnalysis(BaseModel):
    sentiment: str = Field(description="Positive / Neutral / Negative.")
    primary_emotion: str = Field(description="Specific emotion.")
    emotion_target: str = Field(description="Self / Others / General.")
    confrontation_level: str = Field(description="Low / Medium / High.")
    workplace_culture_required: str = Field(description="Culture type.")
    humor_style: str = Field(description="Humor type.")
    humor_function: str = Field(description="Defense / Pride / etc.")


class VibeSchema(BaseModel):
    energy_level: str = Field(description="Low / Medium / High.")
    attitude: str = Field(description="Psychological stance incorporating visual style.")
    core_emotion: str = Field(description="Compound emotion.")


class SemanticStructure(BaseModel):
    structural_template: str = Field(description="Formula representation.")
    wordplay_type: str = Field(description="Type or 'None'.")
    delivery_style: str = Field(description="Tone/Pacing description.")


class TransferabilityNotes(BaseModel):
    works_best_in: list[str] = Field(description="Contexts where it works.")
    avoid_in: list[str] = Field(description="Contexts where it fails.")
    critical_success_factors: list[str] = Field(description="Why it works.")


class SloganEmotionalAnalysisSchema(BaseModel):
    """Structured output from emotional analysis of a product slogan."""

    original_slogan: str = Field(description="Exact text from input.")
    customer_psychology: CustomerPsychology
    sentiment_analysis: SentimentAnalysis
    emotional_pattern: str = Field(
        description="Format: 'Number: Pattern Name' (one of 16 patterns).",
    )
    vibe: VibeSchema
    semantic_structure: SemanticStructure
    key_elements: list[str] = Field(
        description="4-6 key components (power words, psychological hooks).",
    )
    tone: str = Field(description="One sentence summary of the social environment.")
    adaptation_formula: str = Field(description="Abstracted formula for reuse.")
    adaptation_examples: list[str] = Field(
        description="2-4 realistic adaptations for different niches.",
    )
    transferability_notes: TransferabilityNotes


# ---------- Niche Analysis ----------

class PatternItem(BaseModel):
    name: EmotionalPattern = Field(description="The exact name of the design pattern.")
    present: bool = Field(
        description="True if this pattern is actively used in the niche.",
    )
    context: str = Field(
        description=(
            "Evidence-based explanation (2-3 sentences) citing specific slogan "
            "examples. If absent, explain why."
        ),
    )


class NicheAnalysisSchema(BaseModel):
    """Structured output for aggregated niche identity profile."""

    niche_summary: str = Field(
        description="Concise summary including sentiment and dominant emotional target.",
    )
    sentiment: str = Field(description="Strictly one of: Positive, Neutral, Negative.")
    primary_emotions: list[str] = Field(
        description="3-5 primary emotions (single words).",
    )
    emotional_archetype: list[str] = Field(
        description="1-2 archetypes (e.g. Hero, Rebel, Jester).",
    )
    example_keywords: list[str] = Field(
        description="5-7 lowercase keywords for design ideas.",
    )
    pattern_analysis: list[PatternItem] = Field(
        description="Exactly 16 items, one per pattern.",
    )
    emotional_reality: str = Field(
        description=(
            "Single-line: what customers are truly buying emotionally, "
            "including core emotion and intensity."
        ),
    )
    design_concepts: str = Field(
        description=(
            "Single-line: dominant themes, target audience, identity positioning."
        ),
    )
    dominant_design_aesthetics: str = Field(
        description="Single-line: key colors, fonts, vectors, layout patterns.",
    )


# ---------- Keyword Analysis ----------

class NicheKeywordSchema(BaseModel):
    """Structured output for keyword recommendations."""

    main_short_tail: list[str] = Field(description="Main short-tail keywords.")
    main_long_tail: list[str] = Field(description="Main long-tail keywords.")
    all_keywords_flat: str = Field(
        description="All keywords as a single comma-separated string.",
    )
    top_focus_keywords: list[str] = Field(description="Top focus keywords.")
    top_long_tail_keywords: list[str] = Field(description="Top long-tail keywords.")

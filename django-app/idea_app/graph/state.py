"""LangGraph state definitions for slogan workflow."""
from typing import TypedDict


class DiscoveryState(TypedDict, total=False):
    """State for Graph 1: Niche Discovery & Validation."""

    run_id: str  # IdeaAdaptationRun UUID as string
    source_slogan: str
    source_niche_name: str
    source_niche_profile: dict | None  # NicheAnalysis data, None if no research
    target_niches: list[dict]  # [{niche_id, niche_name, profile: dict|None}]
    original_analysis: dict  # Output of analyze_original node
    niche_evaluations: list[dict]  # Per-niche: approved/rejected + reason + score
    validated_products: dict  # niche_id -> list of validated product refs
    error: str | None


class AdaptationState(TypedDict, total=False):
    """State for Graph 2: Slogan Adaptation (runs per approved niche)."""

    run_id: str
    niche_id: str
    niche_name: str
    original_analysis: dict
    niche_context: dict  # Target niche profile + evaluation result
    validated_products: list[dict]
    raw_slogans: list[dict]  # Output of adapt_slogans node
    checked_slogans: list[dict]  # Output of quality_check node
    error: str | None

"""LangGraph state definition for niche research workflow."""

from typing import TypedDict


class ResearchState(TypedDict, total=False):
    """State passed between LangGraph nodes."""

    research_id: str  # UUID as string
    niche_name: str
    marketplace: str
    product_type: str
    product_limit: int
    product_asins: list[str]
    vision_analyses: list[dict]
    emotional_analyses: list[dict]
    analysis_result: dict
    keywords_result: dict
    error: str | None

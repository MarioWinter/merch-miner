"""State reconstruction helpers for resuming LangGraph from DB."""

import logging

from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


@sync_to_async
def load_product_asins_from_db(research_id: str) -> list[str]:
    """Reconstruct product_asins from NicheResearchProduct entries."""
    from niche_research_app.models import NicheResearchProduct

    return list(
        NicheResearchProduct.objects.filter(
            research_id=research_id,
        ).values_list('product__asin', flat=True)
    )


@sync_to_async
def load_vision_analyses_from_db(research_id: str) -> list[dict]:
    """Reconstruct filtered vision_analyses list matching vision node output.

    Applies same filter as vision node: is_niche_match=True, slogan word
    count > 2 (except squad/crew exception).
    """
    from niche_research_app.models import NicheProductVisionAnalysis

    analyses = NicheProductVisionAnalysis.objects.filter(
        research_id=research_id,
        is_niche_match=True,
    ).select_related('product')

    result = []
    for va in analyses:
        slogan = va.slogan_text or ''
        if not slogan.strip():
            continue

        words = slogan.strip().split()
        if len(words) <= 2:
            has_exception = any(
                w.lower() in ('squad', 'crew') for w in words
            )
            if not has_exception:
                continue

        result.append({
            'asin': va.product.asin,
            'title': va.product.title,
            'brand': va.product.brand,
            'thumbnail_url': va.product.thumbnail_url,
            'slogan_text': va.slogan_text,
            'meaning_context': va.meaning_context,
            'visual_style': va.visual_style,
            'graphic_elements': va.graphic_elements,
            'layout_composition': va.layout_composition,
        })

    return result


@sync_to_async
def load_emotional_analyses_from_db(research_id: str) -> list[dict]:
    """Reconstruct emotional_analyses list with nested model_dump() format."""
    from niche_research_app.models import NicheProductEmotionalAnalysis

    analyses = NicheProductEmotionalAnalysis.objects.filter(
        research_id=research_id,
    ).select_related('product')

    result = []
    for ea in analyses:
        # Reconstruct the dict format matching what emotional_analyze_node produces
        # Need vision data from the product for asin/title/brand/slogan_text
        vision_data = _get_vision_data_for_product(research_id, ea.product.asin)

        result.append({
            'asin': ea.product.asin,
            'title': ea.product.title,
            'brand': ea.product.brand,
            'slogan_text': vision_data.get('slogan_text', ''),
            'original_slogan': ea.original_slogan,
            'customer_psychology': ea.customer_psychology,
            'sentiment_analysis': ea.sentiment_analysis,
            'emotional_pattern': ea.emotional_pattern,
            'vibe': ea.vibe,
            'semantic_structure': ea.semantic_structure,
            'key_elements': ea.key_elements,
            'tone': ea.tone,
            'adaptation_formula': ea.adaptation_formula,
            'adaptation_examples': ea.adaptation_examples,
            'transferability_notes': ea.transferability_notes,
        })

    return result


def _get_vision_data_for_product(research_id: str, asin: str) -> dict:
    """Get slogan_text from vision analysis for a product (sync helper)."""
    from niche_research_app.models import NicheProductVisionAnalysis

    try:
        va = NicheProductVisionAnalysis.objects.get(
            research_id=research_id,
            product__asin=asin,
            is_niche_match=True,
        )
        return {'slogan_text': va.slogan_text}
    except NicheProductVisionAnalysis.DoesNotExist:
        return {}


@sync_to_async
def load_analysis_result_from_db(research_id: str) -> dict:
    """Reconstruct analysis_result from NicheAnalysis."""
    from niche_research_app.models import NicheAnalysis

    try:
        na = NicheAnalysis.objects.get(research_id=research_id)
    except NicheAnalysis.DoesNotExist:
        return {}

    return {
        'niche_summary': na.niche_summary,
        'sentiment': na.sentiment,
        'primary_emotions': na.primary_emotions,
        'emotional_archetype': na.emotional_archetype,
        'example_keywords': na.example_keywords,
        'pattern_analysis': na.pattern_analysis,
        'emotional_reality': na.emotional_reality,
        'design_concepts': na.design_concepts,
        'dominant_design_aesthetics': na.dominant_design_aesthetics,
    }


@sync_to_async
def load_keywords_result_from_db(research_id: str) -> dict:
    """Reconstruct keywords_result from NicheKeywordAnalysis."""
    from niche_research_app.models import NicheKeywordAnalysis

    try:
        ka = NicheKeywordAnalysis.objects.get(research_id=research_id)
    except NicheKeywordAnalysis.DoesNotExist:
        return {}

    return {
        'main_short_tail': ka.main_short_tail,
        'main_long_tail': ka.main_long_tail,
        'all_keywords_flat': ka.all_keywords_flat,
        'top_focus_keywords': ka.top_focus_keywords,
        'top_long_tail_keywords': ka.top_long_tail_keywords,
    }

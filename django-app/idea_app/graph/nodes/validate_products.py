"""Node: validate_products -- quality gate on reference products per approved niche."""
import json
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from idea_app.graph.llm import get_slogan_llm
from idea_app.graph.progress import get_completed_nodes, update_node_progress
from idea_app.graph.prompts import DEFAULT_USER_TEMPLATES
from idea_app.graph.schemas import ProductValidationResultSchema
from idea_app.graph.state import DiscoveryState

logger = logging.getLogger(__name__)


@update_node_progress("validate_products")
async def validate_products_node(state: DiscoveryState) -> dict:
    """Validate scraped products as references for each approved niche."""
    run_id = state["run_id"]

    completed = await get_completed_nodes(run_id)
    if "validate_products" in completed and state.get("validated_products"):
        logger.info("Skipping validate_products, already completed")
        return {}

    evaluations = state.get("niche_evaluations", [])
    approved_niches = [
        e for e in evaluations if e.get("approval_status") == "APPROVED"
    ]

    if not approved_niches:
        logger.info(
            "No approved niches, skipping product validation for run %s", run_id
        )
        return {"validated_products": {}}

    llm, system_prompt = await sync_to_async(get_slogan_llm)("validate_products")

    @sync_to_async
    def _load_products(niche_id):
        """Load recent analyzed products for a niche from NicheResearch."""
        from niche_research_app.models import (
            NicheProductVisionAnalysis,
            NicheResearch,
        )

        try:
            latest_research = (
                NicheResearch.objects.filter(
                    niche_id=niche_id,
                    status=NicheResearch.Status.COMPLETED,
                )
                .order_by("-completed_at")
                .first()
            )
            if not latest_research:
                return []
            analyses = NicheProductVisionAnalysis.objects.filter(
                research=latest_research,
            ).select_related("product")[:20]
            return [
                {
                    "asin": a.product.asin,
                    "slogan": a.slogan_text,
                    "visual_style": a.visual_style,
                    "is_niche_match": a.is_niche_match,
                }
                for a in analyses
                if a.is_niche_match
            ]
        except Exception:
            logger.exception("Failed to load products for niche %s", niche_id)
            return []

    validated = {}
    for niche_eval in approved_niches:
        niche_id = niche_eval["niche_id"]
        niche_name = niche_eval["niche_name"]

        products = await _load_products(niche_id)
        if not products:
            logger.info(
                "No products found for niche %s, using empty refs", niche_name
            )
            validated[niche_id] = []
            continue

        products_text = json.dumps(products, indent=2)
        user_text = DEFAULT_USER_TEMPLATES["validate_products"].format(
            original_analysis=json.dumps(state["original_analysis"], indent=2),
            niche_name=niche_name,
            niche_id=niche_id,
            products_text=products_text,
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_text),
        ]

        try:
            structured_llm = llm.with_structured_output(
                ProductValidationResultSchema,
            )
            result = await structured_llm.ainvoke(messages)
            passed = [
                p.model_dump()
                for p in result.validated_products
                if p.quality_gate == "PROCEED"
            ]
            validated[niche_id] = passed
        except Exception:
            logger.exception(
                "Product validation failed for niche %s", niche_name
            )
            validated[niche_id] = []

    logger.info(
        "validate_products completed for run %s: %d niches processed",
        run_id,
        len(validated),
    )
    return {"validated_products": validated}

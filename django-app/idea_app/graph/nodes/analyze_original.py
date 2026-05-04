"""Node: analyze_original -- deconstruct source slogan into formula + patterns."""
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from idea_app.graph.llm import get_slogan_llm
from idea_app.graph.progress import get_completed_nodes, update_node_progress
from idea_app.graph.prompts import DEFAULT_USER_TEMPLATES
from idea_app.graph.schemas import OriginalAnalysisSchema
from idea_app.graph.state import DiscoveryState

logger = logging.getLogger(__name__)


@update_node_progress("analyze_original")
async def analyze_original_node(state: DiscoveryState) -> dict:
    """Deconstruct source slogan: extract pattern, formula, signal type, power words."""
    run_id = state["run_id"]

    # Skip guard
    completed = await get_completed_nodes(run_id)
    if "analyze_original" in completed and state.get("original_analysis"):
        logger.info("Skipping analyze_original, already completed")
        return {}

    llm, system_prompt = await sync_to_async(get_slogan_llm)("analyze_original")
    structured_llm = llm.with_structured_output(OriginalAnalysisSchema)

    niche_profile = state.get("source_niche_profile")
    profile_text = (
        str(niche_profile) if niche_profile else "No research data available."
    )

    user_text = DEFAULT_USER_TEMPLATES["analyze_original"].format(
        source_slogan=state["source_slogan"],
        source_niche_name=state["source_niche_name"],
        source_niche_profile=profile_text,
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_text),
    ]

    result = await structured_llm.ainvoke(messages)
    analysis = result.model_dump()

    logger.info("analyze_original completed for run %s", run_id)
    return {"original_analysis": analysis}

"""Node: quality_check -- post-generation validation + auto-correction."""
import json
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from idea_app.graph.llm import get_slogan_llm
from idea_app.graph.progress import get_completed_nodes, update_node_progress
from idea_app.graph.prompts import DEFAULT_USER_TEMPLATES
from idea_app.graph.schemas import QualityCheckOutputSchema
from idea_app.graph.state import AdaptationState

logger = logging.getLogger(__name__)


@update_node_progress("quality_check")
async def quality_check_node(state: AdaptationState) -> dict:
    """Validate + auto-correct adapted slogans."""
    run_id = state["run_id"]

    completed = await get_completed_nodes(run_id)
    if "quality_check" in completed and state.get("checked_slogans"):
        logger.info("Skipping quality_check, already completed")
        return {}

    raw_slogans = state.get("raw_slogans", [])
    if not raw_slogans:
        logger.warning("No raw slogans to check for run %s", run_id)
        return {"checked_slogans": []}

    llm, system_prompt = await sync_to_async(get_slogan_llm)("quality_check")
    structured_llm = llm.with_structured_output(QualityCheckOutputSchema)

    original_analysis = state.get("original_analysis", {})
    slogans_text = json.dumps(raw_slogans, indent=2)

    user_text = DEFAULT_USER_TEMPLATES["quality_check"].format(
        niche_name=state["niche_name"],
        original_signal_type=original_analysis.get("signal_type", ""),
        slogans_text=slogans_text,
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_text),
    ]

    result = await structured_llm.ainvoke(messages)
    checked = [r.model_dump() for r in result.results]

    changed_count = sum(1 for c in checked if c.get("was_changed"))
    logger.info(
        "quality_check: %d/%d slogans corrected for niche %s (run %s)",
        changed_count,
        len(checked),
        state["niche_name"],
        run_id,
    )
    return {"checked_slogans": checked}

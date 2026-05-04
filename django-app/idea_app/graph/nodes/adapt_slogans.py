"""Node: adapt_slogans -- generate 10 slogans per niche (5 SELF + 5 OTHER)."""
import json
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from idea_app.graph.llm import get_slogan_llm
from idea_app.graph.progress import get_completed_nodes, update_node_progress
from idea_app.graph.prompts import DEFAULT_USER_TEMPLATES
from idea_app.graph.schemas import AdaptationOutputSchema
from idea_app.graph.state import AdaptationState

logger = logging.getLogger(__name__)


@update_node_progress("adapt_slogans")
async def adapt_slogans_node(state: AdaptationState) -> dict:
    """Generate 10 adapted slogans (5 SELF + 5 OTHER) for target niche."""
    run_id = state["run_id"]

    completed = await get_completed_nodes(run_id)
    if "adapt_slogans" in completed and state.get("raw_slogans"):
        logger.info("Skipping adapt_slogans, already completed")
        return {}

    llm, system_prompt = await sync_to_async(get_slogan_llm)("adapt_slogans")
    structured_llm = llm.with_structured_output(AdaptationOutputSchema)

    original = state["original_analysis"]
    niche_context = state.get("niche_context", {})
    signal_conversion = niche_context.get("signal_conversion", {})
    validated_products = state.get("validated_products", [])

    user_text = DEFAULT_USER_TEMPLATES["adapt_slogans"].format(
        source_slogan=original.get("source_slogan", ""),
        primary_pattern=original.get("primary_pattern", ""),
        formula_pattern=original.get("formula_pattern", ""),
        signal_type=original.get("signal_type", ""),
        sentence_structure=original.get("sentence_structure", ""),
        power_words=", ".join(original.get("power_words", [])),
        energy=original.get("energy", ""),
        tone=original.get("tone", ""),
        niche_name=state["niche_name"],
        niche_context=json.dumps(niche_context, indent=2),
        signal_conversion=json.dumps(signal_conversion, indent=2),
        validated_products=json.dumps(validated_products[:5], indent=2),
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_text),
    ]

    result = await structured_llm.ainvoke(messages)
    raw_slogans = [s.model_dump() for s in result.slogans]

    logger.info(
        "adapt_slogans: %d slogans generated for niche %s (run %s)",
        len(raw_slogans),
        state["niche_name"],
        run_id,
    )
    return {"raw_slogans": raw_slogans}

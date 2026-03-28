"""Node: discover_niches -- evaluate target niche compatibility, score >=75 = APPROVED."""
import json
import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage

from idea_app.graph.llm import get_slogan_llm
from idea_app.graph.progress import get_completed_nodes, update_node_progress
from idea_app.graph.prompts import DEFAULT_USER_TEMPLATES
from idea_app.graph.schemas import NicheEvaluationSchema
from idea_app.graph.state import DiscoveryState

logger = logging.getLogger(__name__)


@update_node_progress("discover_niches")
async def discover_niches_node(state: DiscoveryState) -> dict:
    """Evaluate each target niche for slogan compatibility."""
    run_id = state["run_id"]

    completed = await get_completed_nodes(run_id)
    if "discover_niches" in completed and state.get("niche_evaluations"):
        logger.info("Skipping discover_niches, already completed")
        return {}

    llm, system_prompt = await sync_to_async(get_slogan_llm)("discover_niches")

    # Build target niches text block
    target_niches = state["target_niches"]
    niches_text_parts = []
    for t in target_niches:
        profile = t.get("profile")
        profile_str = (
            json.dumps(profile, indent=2)
            if profile
            else "No research data (degraded mode)."
        )
        niches_text_parts.append(
            f"- **{t['niche_name']}** (ID: {t['niche_id']})\n"
            f"  Profile: {profile_str}"
        )
    target_niches_text = "\n".join(niches_text_parts)

    user_text = DEFAULT_USER_TEMPLATES["discover_niches"].format(
        source_slogan=state["source_slogan"],
        source_niche_name=state["source_niche_name"],
        original_analysis=json.dumps(state["original_analysis"], indent=2),
        target_niches_text=target_niches_text,
    )

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_text),
    ]

    # Evaluate all niches in one call
    structured_llm = llm.with_structured_output(list[NicheEvaluationSchema])
    try:
        results = await structured_llm.ainvoke(messages)
        evaluations = [r.model_dump() for r in results]
    except Exception:
        # Fallback: evaluate one by one
        logger.warning("Batch evaluation failed, falling back to individual calls")
        structured_llm = llm.with_structured_output(NicheEvaluationSchema)
        evaluations = []
        for t in target_niches:
            try:
                profile = t.get("profile")
                profile_str = (
                    json.dumps(profile, indent=2)
                    if profile
                    else "No research data."
                )
                single_text = DEFAULT_USER_TEMPLATES["discover_niches"].format(
                    source_slogan=state["source_slogan"],
                    source_niche_name=state["source_niche_name"],
                    original_analysis=json.dumps(
                        state["original_analysis"], indent=2
                    ),
                    target_niches_text=(
                        f"- **{t['niche_name']}** (ID: {t['niche_id']})\n"
                        f"  Profile: {profile_str}"
                    ),
                )
                single_messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=single_text),
                ]
                result = await structured_llm.ainvoke(single_messages)
                evaluations.append(result.model_dump())
            except Exception:
                logger.exception("Failed to evaluate niche %s", t["niche_name"])
                evaluations.append({
                    "niche_id": t["niche_id"],
                    "niche_name": t["niche_name"],
                    "approval_status": "REJECTED",
                    "compatibility_score": 0,
                    "signal_conversion": {
                        "required": False,
                        "direction": "",
                        "transformation_strategy": "",
                    },
                    "rejection_reason": "Evaluation failed due to LLM error.",
                    "emotional_alignment": "",
                })

    approved = sum(
        1 for e in evaluations if e.get("approval_status") == "APPROVED"
    )
    logger.info(
        "discover_niches: %d/%d niches approved for run %s",
        approved,
        len(evaluations),
        run_id,
    )

    return {"niche_evaluations": evaluations}

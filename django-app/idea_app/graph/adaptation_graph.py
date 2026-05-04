"""Graph 2: Slogan Adaptation -- runs per approved niche."""
import logging

from langgraph.graph import END, StateGraph

from idea_app.graph.nodes.adapt_slogans import adapt_slogans_node
from idea_app.graph.nodes.quality_check import quality_check_node
from idea_app.graph.state import AdaptationState

logger = logging.getLogger(__name__)


def build_adaptation_graph() -> StateGraph:
    """Build and return the (uncompiled) adaptation StateGraph."""
    graph = StateGraph(AdaptationState)

    graph.add_node("adapt_slogans", adapt_slogans_node)
    graph.add_node("quality_check", quality_check_node)

    graph.set_entry_point("adapt_slogans")
    graph.add_edge("adapt_slogans", "quality_check")
    graph.add_edge("quality_check", END)

    return graph


async def compile_and_run_adaptation(
    run_id: str,
    niche_id: str,
    niche_name: str,
    original_analysis: dict,
    niche_context: dict,
    validated_products: list[dict],
    retry_count: int = 0,
    checkpointer=None,
    callbacks=None,
) -> dict:
    """Compile graph and invoke it. Returns final state."""
    graph = build_adaptation_graph()

    compile_kwargs = {}
    if checkpointer:
        compile_kwargs["checkpointer"] = checkpointer

    try:
        from langgraph.pregel import RetryPolicy

        compile_kwargs["retry_policy"] = RetryPolicy(max_attempts=3)
    except ImportError:
        logger.warning("RetryPolicy not available")

    compiled = graph.compile(**compile_kwargs)

    config = {}
    if checkpointer:
        thread_id = f"{run_id}__adapt__{niche_id}__attempt_{retry_count}"
        config["configurable"] = {"thread_id": thread_id}
    if callbacks:
        config["callbacks"] = callbacks

    initial_state = {
        "run_id": run_id,
        "niche_id": niche_id,
        "niche_name": niche_name,
        "original_analysis": original_analysis,
        "niche_context": niche_context,
        "validated_products": validated_products,
    }

    result = await compiled.ainvoke(initial_state, config=config)
    return result

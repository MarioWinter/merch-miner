"""Graph 1: Niche Discovery & Validation -- reusable by PROJ-18 Agent."""
import logging

from langgraph.graph import END, StateGraph

from idea_app.graph.nodes.analyze_original import analyze_original_node
from idea_app.graph.nodes.discover_niches import discover_niches_node
from idea_app.graph.nodes.validate_products import validate_products_node
from idea_app.graph.state import DiscoveryState

logger = logging.getLogger(__name__)


def build_discovery_graph() -> StateGraph:
    """Build and return the (uncompiled) discovery StateGraph."""
    graph = StateGraph(DiscoveryState)

    graph.add_node("analyze_original", analyze_original_node)
    graph.add_node("discover_niches", discover_niches_node)
    graph.add_node("validate_products", validate_products_node)

    graph.set_entry_point("analyze_original")
    graph.add_edge("analyze_original", "discover_niches")
    graph.add_edge("discover_niches", "validate_products")
    graph.add_edge("validate_products", END)

    return graph


async def compile_and_run_discovery(
    run_id: str,
    source_slogan: str,
    source_niche_name: str,
    source_niche_profile: dict | None,
    target_niches: list[dict],
    retry_count: int = 0,
    checkpointer=None,
    callbacks=None,
) -> dict:
    """Compile graph and invoke it. Returns final state."""
    graph = build_discovery_graph()

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
        thread_id = f"{run_id}__discovery__attempt_{retry_count}"
        config["configurable"] = {"thread_id": thread_id}
    if callbacks:
        config["callbacks"] = callbacks

    initial_state = {
        "run_id": run_id,
        "source_slogan": source_slogan,
        "source_niche_name": source_niche_name,
        "source_niche_profile": source_niche_profile,
        "target_niches": target_niches,
    }

    result = await compiled.ainvoke(initial_state, config=config)
    return result

"""Node: niche_profile - ReAct agent with SearXNG + structured niche analysis."""

import logging

from asgiref.sync import sync_to_async
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from niche_research_app.graph.llm import get_llm_for_node
from niche_research_app.graph.progress import get_completed_nodes, update_node_progress
from niche_research_app.graph.resume import load_analysis_result_from_db
from niche_research_app.graph.schemas import NicheAnalysisSchema
from niche_research_app.graph.state import ResearchState
from niche_research_app.graph.tools import searxng_search

logger = logging.getLogger(__name__)


def _format_emotional_analyses_markdown(niche_name: str, analyses: list[dict]) -> str:
    """Format emotional analyses as structured Markdown for LLM input."""
    sections = [f"# Niche: {niche_name}\n"]

    for i, a in enumerate(analyses, 1):
        sections.append(f"## Product {i}: {a.get('title', 'Unknown')}")
        sections.append(f"- **ASIN:** {a.get('asin', '')}")
        sections.append(f"- **Brand:** {a.get('brand', '')}")
        sections.append(f"- **Slogan:** {a.get('slogan_text', '')}")
        sections.append(f"- **Original Slogan:** {a.get('original_slogan', '')}")
        sections.append(f"- **Emotional Pattern:** {a.get('emotional_pattern', '')}")
        sections.append(f"- **Tone:** {a.get('tone', '')}")

        psych = a.get('customer_psychology', {})
        sections.append("### Customer Psychology")
        sections.append(f"- Buyer Profile: {psych.get('buyer_profile', '')}")
        sections.append(f"- Emotional Need: {psych.get('emotional_need', '')}")
        sections.append(f"- Internal Monologue: {psych.get('internal_monologue', '')}")
        sections.append(
            f"- Unspoken Truth: {psych.get('what_they_cant_say_out_loud', '')}"
        )

        sent = a.get('sentiment_analysis', {})
        sections.append("### Sentiment Analysis")
        sections.append(f"- Sentiment: {sent.get('sentiment', '')}")
        sections.append(f"- Primary Emotion: {sent.get('primary_emotion', '')}")
        sections.append(f"- Emotion Target: {sent.get('emotion_target', '')}")
        sections.append(f"- Confrontation Level: {sent.get('confrontation_level', '')}")
        sections.append(f"- Humor Style: {sent.get('humor_style', '')}")

        vibe = a.get('vibe', {})
        sections.append("### Vibe")
        sections.append(f"- Energy: {vibe.get('energy_level', '')}")
        sections.append(f"- Attitude: {vibe.get('attitude', '')}")
        sections.append(f"- Core Emotion: {vibe.get('core_emotion', '')}")

        sections.append(f"- **Key Elements:** {', '.join(a.get('key_elements', []))}")
        sections.append(f"- **Adaptation Formula:** {a.get('adaptation_formula', '')}")
        sections.append("")

    return "\n".join(sections)


@update_node_progress('niche_profile')
async def niche_profile_node(state: ResearchState) -> dict:
    """Run ReAct agent with SearXNG, then produce structured niche analysis."""
    from niche_research_app.models import NicheAnalysis, NicheResearch

    research_id = state['research_id']

    # Skip guard
    completed = await get_completed_nodes(research_id)
    if 'niche_profile' in completed:
        logger.info("Skipping niche_profile node, already completed")
        analysis_result = await load_analysis_result_from_db(research_id)
        return {'analysis_result': analysis_result}
    niche_name = state['niche_name']
    emotional_analyses = state['emotional_analyses']

    llm, system_prompt = await sync_to_async(get_llm_for_node)('niche_profile')

    # Format input as structured Markdown
    user_content = _format_emotional_analyses_markdown(niche_name, emotional_analyses)

    # Run ReAct agent with SearXNG tool
    agent = create_react_agent(
        model=llm,
        tools=[searxng_search],
        prompt=system_prompt,
    )

    agent_result = await agent.ainvoke({
        'messages': [HumanMessage(content=user_content)],
    })

    # Extract agent's final output (last AI message)
    agent_messages = agent_result.get('messages', [])
    agent_output = ""
    for msg in reversed(agent_messages):
        if hasattr(msg, 'content') and isinstance(msg.content, str) and msg.content:
            agent_output = msg.content
            break

    # Final structured output call
    structured_llm = llm.with_structured_output(NicheAnalysisSchema)

    final_prompt = (
        f"Based on the following analysis of the niche '{niche_name}', "
        f"produce the structured niche identity profile.\n\n"
        f"## Agent Analysis:\n{agent_output}\n\n"
        f"## Raw Emotional Analyses:\n{user_content}"
    )

    analysis = await structured_llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=final_prompt),
    ])

    # Save to DB
    @sync_to_async
    def _save_analysis():
        research = NicheResearch.objects.select_related('niche').get(id=research_id)
        NicheAnalysis.objects.create(
            research=research,
            niche=research.niche,
            niche_summary=analysis.niche_summary,
            sentiment=analysis.sentiment,
            primary_emotions=analysis.primary_emotions,
            emotional_archetype=analysis.emotional_archetype,
            example_keywords=analysis.example_keywords,
            pattern_analysis=[p.model_dump() for p in analysis.pattern_analysis],
            emotional_reality=analysis.emotional_reality,
            design_concepts=analysis.design_concepts,
            dominant_design_aesthetics=analysis.dominant_design_aesthetics,
        )

    await _save_analysis()

    logger.info("Niche profile node complete for '%s'", niche_name)

    return {'analysis_result': analysis.model_dump()}

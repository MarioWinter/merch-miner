"""PROJ-29 Phase 1B — idea helper services."""

from __future__ import annotations

from idea_app.models import Idea


def get_recent_slogans_sample(niche, limit: int = 20) -> str:
    """Return up to ``limit`` recent slogans for ``niche`` as a markdown list.

    Used as ``{recent_slogans_sample}`` placeholder in the ``creative_techniques``
    prompt so the LLM can avoid duplicating existing approved/manual slogans
    when generating new ones.
    """
    queryset = (
        Idea.objects
        .filter(niche=niche)
        .order_by('-created_at')
        .only('slogan_text', 'pattern_used', 'signal_type')[:limit]
    )
    lines = [
        f"- {idea.slogan_text} "
        f"(pattern: {idea.pattern_used or '?'}, "
        f"signal: {idea.signal_type or '?'})"
        for idea in queryset
    ]
    return '\n'.join(lines) if lines else '(no slogans yet)'

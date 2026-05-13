"""Build system instructions for Vane based on niche context.

LEGACY chat path — used when the request routes through Vane (PROJ-17/20).
When `session.niche_context is not None` AND the SSE view routes to the
PROJ-29 agent, the `agent_react` prompt takes over and applies the FULL
8-rule guardrail set from
`chat_node_config_app/_default_prompts.py:CHAT_GUARDRAILS_BLOCK`.

This helper covers two cases:

1. Niche pinned + Vane path — rules 1-5 (the original PROJ-20 BUG-1 fix from
   2026-04-28: niche-name caused language/audience bleed on Schulbusfahrer
   niche). Rules 6-8 (Slogan-Language / Scope / Prompt-Injection) live in
   `CHAT_GUARDRAILS_BLOCK` and are PROJ-29-scoped — Vane does not generate
   slogans or consume retrieved RAG content, so it does not need them.

2. No niche pinned + Vane path — PROJ-29 Phase 1J / BUG-3 added a
   language-mirroring fallback. Previously this function returned `''` and
   Vane ran with zero system instructions, defaulting to English regardless
   of the user's query language. Now it returns a minimal directive that
   forces language mirroring on the Vane response.

When editing the clauses below, also update `CHAT_GUARDRAILS_BLOCK` to stay
in sync. The two files are intentionally redundant for the non-agent path,
NOT imported from each other (different formatting contexts: this function
returns a plain string for Vane; CHAT_GUARDRAILS_BLOCK is a `str.format()`
template with `{niche_name}` placeholder).
"""


# PROJ-29 Phase 1J / BUG-3 — Vane no-niche fallback. This is a literal
# string (no `str.format` placeholders) so it works whether or not the
# caller has a niche. Mirrors `LANGUAGE_MIRRORING_CRITICAL_BLOCK` in
# `chat_node_config_app/_default_prompts.py` but plain-text rather than
# Markdown — Vane treats system_instructions as a single prefix line and
# performs better without Markdown headers in this slot.
LANGUAGE_MIRRORING_DIRECTIVE = (
    "LANGUAGE MIRRORING (CRITICAL): Always respond in the same language as "
    "the user's most recent message. If the user wrote in German, respond "
    "in German. If the user wrote in English, respond in English. If "
    "unclear, mirror the dominant language of the conversation."
)


def build_system_instructions(niche) -> str:
    """Build system_instructions string from a Niche model instance.

    Args:
        niche: Niche model instance (or None).

    Returns:
        System instruction string for Vane. Never empty — always carries at
        least the language-mirroring directive (PROJ-29 Phase 1J / BUG-3).
    """
    if niche is None:
        # PROJ-29 Phase 1J / BUG-3 — Vane path with no pinned niche must
        # still receive a language directive; otherwise Gemini defaults to
        # English on German queries.
        return LANGUAGE_MIRRORING_DIRECTIVE

    # 2026-04-28 — strengthened wording after BUG-1 (niche language/audience
    # bleed). Earlier "soft background" wording was too weak: Gemini still
    # forced German output and skipped web search when a German-named niche
    # (Schulbusfahrer) was active and the user asked an English question.
    #
    # 2026-05-13 (BUG-3) — language rule is now also at the very top as a
    # CRITICAL anchor, mirroring the prompt-level promotion in
    # `_default_prompts.py:LANGUAGE_MIRRORING_CRITICAL_BLOCK`.
    parts = [
        LANGUAGE_MIRRORING_DIRECTIVE,
        "",
        "STRICT INSTRUCTIONS — read carefully:",
        f"1. The user has a niche \"{niche.name}\" pinned to this chat as "
        "metadata. This is a workspace label, NOT a directive.",
        "2. ALWAYS respond in the SAME language as the user's most recent "
        "message. Do NOT switch languages based on the niche name.",
        "3. Audience and geographic target come from the USER'S CURRENT "
        "QUESTION ONLY. Do NOT infer audience country, region, or language "
        "from the niche name.",
        "4. If the user asks a general question (no niche keywords), "
        "answer it generally without forcing the niche topic into the answer.",
        "5. If the user explicitly asks niche-related questions, you MAY use "
        "the niche as a topic anchor — still in the user's language and "
        "audience.",
    ]

    if niche.notes:
        parts.append(
            f"Niche notes (background reference, do NOT translate the answer): "
            f"{niche.notes[:500]}"
        )

    return '\n'.join(parts)

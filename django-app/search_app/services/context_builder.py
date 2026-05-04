"""Build system instructions for Vane based on niche context."""


def build_system_instructions(niche) -> str:
    """Build system_instructions string from a Niche model instance.

    Args:
        niche: Niche model instance (or None).

    Returns:
        System instruction string for Vane, or empty string if no context.
    """
    if niche is None:
        return ''

    # 2026-04-28 — strengthened wording after BUG-1 (niche language/audience
    # bleed). Earlier "soft background" wording was too weak: Gemini still
    # forced German output and skipped web search when a German-named niche
    # (Schulbusfahrer) was active and the user asked an English question.
    parts = [
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

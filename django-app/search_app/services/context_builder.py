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

    parts = [
        # Soft context — informational, not a behavioural lock-in. We had a
        # report (2026-04-28) where the niche language (German "Schulbusfahrer")
        # bled into the answer even though the user expected English/USA-
        # targeted output. Be explicit that the niche is BACKGROUND only and
        # the user's query language drives the answer language.
        f"Background context: the user works on a Print-on-Demand niche called \"{niche.name}\". "
        "Use this only as soft background; if the current question is general, "
        "answer it as a general question. Always respond in the language of the "
        "user's most recent message and target the audience implied by that "
        "message (do not infer audience country/language from the niche name).",
    ]

    if niche.notes:
        parts.append(f"Niche notes (for reference only): {niche.notes[:500]}")

    return ' '.join(parts)

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
        f"The user is researching the niche: {niche.name}.",
        "Tailor your search results to this context.",
    ]

    if niche.notes:
        parts.append(f"Additional context: {niche.notes[:500]}")

    return ' '.join(parts)

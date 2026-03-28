"""Auto-import keywords from research completion (PROJ-6 signal handler)."""

import logging

from keyword_app.models import NicheKeyword

logger = logging.getLogger(__name__)


def import_research_keywords(niche_research):
    """
    Auto-import top_focus_keywords + main_short_tail from NicheKeywordAnalysis
    into NicheKeyword rows with source=research. Skips duplicates silently.
    """
    keyword_analyses = niche_research.keyword_analyses.all()
    if not keyword_analyses.exists():
        logger.info(
            "No keyword analyses for research %s, skipping auto-import",
            niche_research.id,
        )
        return 0

    niche = niche_research.niche
    keywords_to_import = set()

    for analysis in keyword_analyses:
        for kw in (analysis.top_focus_keywords or []):
            if isinstance(kw, str) and kw.strip():
                keywords_to_import.add(kw.strip()[:200])
        for kw in (analysis.main_short_tail or []):
            if isinstance(kw, str) and kw.strip():
                keywords_to_import.add(kw.strip()[:200])

    if not keywords_to_import:
        return 0

    # Get existing keywords for this niche to skip duplicates
    existing = set(
        NicheKeyword.objects.filter(
            niche=niche,
            keyword__in=keywords_to_import,
        ).values_list('keyword', flat=True)
    )

    new_keywords = keywords_to_import - existing
    if not new_keywords:
        return 0

    objs = [
        NicheKeyword(
            niche=niche,
            keyword=kw,
            source=NicheKeyword.Source.RESEARCH,
            created_by=niche_research.triggered_by,
        )
        for kw in new_keywords
    ]
    created = NicheKeyword.objects.bulk_create(objs, ignore_conflicts=True)
    logger.info(
        "Auto-imported %d research keywords for niche %s",
        len(created),
        niche.id,
    )
    return len(created)

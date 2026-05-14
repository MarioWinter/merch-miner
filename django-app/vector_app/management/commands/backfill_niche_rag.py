"""PROJ-29 Phase 1B Round 3: one-shot backfill of niche-scoped embeddings.

Walks Idea + NicheNote (+ optionally other content types) and enqueues
`create_or_update_embedding` for each row. Pre-flight cost estimation
guards against accidental large LLM/embedding runs (default budget $20).

Usage:
    python manage.py backfill_niche_rag --content-type slogan
    python manage.py backfill_niche_rag --niche <UUID> --dry-run
    python manage.py backfill_niche_rag --content-type all --budget 50
    python manage.py backfill_niche_rag --content-type all --reembed-existing
"""

import logging
import os
import sys

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from vector_app.tasks import create_or_update_embedding

logger = logging.getLogger(__name__)


CONTENT_TYPE_CHOICES = [
    'slogan', 'product', 'keyword', 'notes',
    # PROJ-29 follow-up: niche-research output. These rows are auto-embedded
    # via post_save signals (vector_app/signals.py) — but ONLY for rows
    # CREATED AFTER the signal registration (Phase 1B-1, commit 4248f61).
    # Existing niches whose research ran earlier never got embeddings →
    # `search_niche_knowledge` returns 0 hits → admin needs to run this
    # backfill once post-deploy to index historical research.
    'profile',           # NicheAnalysis (niche_summary, emotional_reality, etc.)
    'emotional',         # NicheProductEmotionalAnalysis (per product)
    'vision',            # NicheProductVisionAnalysis (per product)
    'keyword_analysis',  # NicheKeywordAnalysis (research keyword output)
    'research',          # alias for profile + emotional + vision + keyword_analysis
    'all',
]

# Cost-estimation constants (PROJ-29 Phase 1B Round 3 task-file algorithm).
_AVG_INPUT_TOKENS_PER_ROW = 200
_CONTEXT_HEADER_TOKENS = 60
_EMBEDDING_PRICE_PER_1M = 0.02      # text-embedding-3-small
_HEADER_LLM_INPUT_PER_1M = 0.40     # gpt-4.1-mini input
_HEADER_LLM_OUTPUT_PER_1M = 1.60    # gpt-4.1-mini output
_COST_SAFETY_MARGIN = 1.2           # +20% headroom
_DEFAULT_BUDGET_USD = float(os.environ.get('NICHE_RAG_BACKFILL_BUDGET_USD', '20'))
_BATCH_SIZE = 50


def _resolve_source_models(content_type: str):
    """Map --content-type to (model_class, content_subtype, niche_filter_key) tuples.

    The third tuple element is the kwarg-name used in `_filter_by_niche` —
    most models have a direct `niche_id` FK; per-product analyses (Emotional /
    Vision) reach the niche via `research__niche_id`.
    """
    from idea_app.models import Idea
    from keyword_app.models import NicheKeyword
    from niche_app.models import CollectedProduct, NicheNote
    from niche_research_app.models import (
        NicheAnalysis,
        NicheKeywordAnalysis,
        NicheProductEmotionalAnalysis,
        NicheProductVisionAnalysis,
    )

    mapping = {
        'slogan': [(Idea, 'slogan', 'niche_id')],
        'notes': [(NicheNote, 'notes', 'niche_id')],
        'product': [(CollectedProduct, 'product', 'niche_id')],
        'keyword': [(NicheKeyword, 'keyword', 'niche_id')],
        # PROJ-29 follow-up: niche-research output (auto-embedded via signal
        # for new rows; this list lets the backfill cover historical rows).
        'profile': [(NicheAnalysis, 'profile', 'niche_id')],
        'emotional': [(NicheProductEmotionalAnalysis, 'emotional', 'research__niche_id')],
        'vision': [(NicheProductVisionAnalysis, 'vision', 'research__niche_id')],
        'keyword_analysis': [(NicheKeywordAnalysis, 'keyword_analysis', 'niche_id')],
    }
    if content_type == 'research':
        # All niche-research output (no Ideas/Notes/Products/Keywords).
        return (
            mapping['profile']
            + mapping['emotional']
            + mapping['vision']
            + mapping['keyword_analysis']
        )
    if content_type == 'all':
        return (
            mapping['slogan']
            + mapping['notes']
            + mapping['product']
            + mapping['keyword']
            + mapping['profile']
            + mapping['emotional']
            + mapping['vision']
            + mapping['keyword_analysis']
        )
    return mapping[content_type]


def _filter_by_niche(qs, niche_id, filter_key='niche_id'):
    if niche_id is None:
        return qs
    return qs.filter(**{filter_key: niche_id})


def _estimate_cost_usd(count_rows: int) -> float:
    if count_rows == 0:
        return 0.0
    per_row_cost = (
        (_AVG_INPUT_TOKENS_PER_ROW + _CONTEXT_HEADER_TOKENS)
        * _EMBEDDING_PRICE_PER_1M / 1_000_000
        + _AVG_INPUT_TOKENS_PER_ROW * _HEADER_LLM_INPUT_PER_1M / 1_000_000
        + _CONTEXT_HEADER_TOKENS * _HEADER_LLM_OUTPUT_PER_1M / 1_000_000
    )
    return count_rows * per_row_cost * _COST_SAFETY_MARGIN


class Command(BaseCommand):
    help = (
        'PROJ-29: one-shot backfill of niche-scoped embeddings with '
        'pre-flight cost estimation + budget guard.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--niche',
            type=str,
            default=None,
            help='Limit to one niche (UUID).',
        )
        parser.add_argument(
            '--content-type',
            type=str,
            choices=CONTENT_TYPE_CHOICES,
            default='all',
            help='Source content type to backfill (default: all).',
        )
        parser.add_argument(
            '--budget',
            type=float,
            default=_DEFAULT_BUDGET_USD,
            help=f'Max estimated USD cost (default: ${_DEFAULT_BUDGET_USD}).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Estimate cost + print breakdown; do not enqueue any jobs.',
        )
        parser.add_argument(
            '--reembed-existing',
            action='store_true',
            help='Force re-embed even when an Embedding row already exists.',
        )

    def handle(self, *args, **options):
        niche_id = options['niche']
        content_type = options['content_type']
        budget = options['budget']
        dry_run = options['dry_run']
        reembed = options['reembed_existing']

        sources = _resolve_source_models(content_type)
        total_count = 0
        per_source_counts: list[tuple[str, int]] = []
        for model_class, _subtype, filter_key in sources:
            qs = _filter_by_niche(
                model_class.objects.all(), niche_id, filter_key=filter_key,
            )
            count = qs.count()
            total_count += count
            per_source_counts.append((model_class.__name__, count))

        estimated_cost = _estimate_cost_usd(total_count)

        self.stdout.write('--- backfill_niche_rag pre-flight ---')
        self.stdout.write(f'niche             : {niche_id or "(all)"}')
        self.stdout.write(f'content_type      : {content_type}')
        self.stdout.write(f'rows to process   : {total_count}')
        for name, n in per_source_counts:
            self.stdout.write(f'  {name:<20}: {n}')
        self.stdout.write(f'estimated cost USD: ${estimated_cost:.4f} '
                          f'(@ avg {_AVG_INPUT_TOKENS_PER_ROW} input + {_CONTEXT_HEADER_TOKENS} header tokens/row, +{int((_COST_SAFETY_MARGIN-1)*100)}% margin)')
        self.stdout.write(f'budget            : ${budget:.2f}')

        if estimated_cost > budget:
            msg = (
                f'Budget ${budget:.2f} exceeded by ${estimated_cost - budget:.4f}. '
                f'Raise via --budget or NICHE_RAG_BACKFILL_BUDGET_USD env.'
            )
            self.stderr.write(self.style.ERROR(msg))
            sys.exit(2)

        if dry_run:
            self.stdout.write(self.style.WARNING('--dry-run: no jobs enqueued.'))
            return

        if reembed:
            self.stdout.write(self.style.WARNING(
                '--reembed-existing: existing Embedding rows will be deleted before re-creation.'
            ))

        # Track running cost projection — abort mid-run if > budget × 1.1.
        cumulative_rows = 0
        max_projected_cost = budget * 1.1

        queue = django_rq.get_queue('default')
        for model_class, _subtype, filter_key in sources:
            qs = _filter_by_niche(
                model_class.objects.all(), niche_id, filter_key=filter_key,
            )
            ct = ContentType.objects.get_for_model(model_class)
            batch: list[str] = []
            for pk in qs.values_list('pk', flat=True).iterator():
                batch.append(str(pk))
                if len(batch) >= _BATCH_SIZE:
                    self._enqueue_batch(queue, ct, batch, reembed)
                    cumulative_rows += len(batch)
                    batch = []
                    projected = _estimate_cost_usd(cumulative_rows) * (total_count / max(cumulative_rows, 1))
                    if projected > max_projected_cost:
                        self.stderr.write(self.style.ERROR(
                            f'Mid-run cost overrun: projected ${projected:.4f} > '
                            f'${max_projected_cost:.4f}. Aborting after {cumulative_rows} rows.'
                        ))
                        sys.exit(2)
            if batch:
                self._enqueue_batch(queue, ct, batch, reembed)
                cumulative_rows += len(batch)

        self.stdout.write(self.style.SUCCESS(
            f'Enqueued {cumulative_rows} embedding jobs (est. ${_estimate_cost_usd(cumulative_rows):.4f}).'
        ))

    def _enqueue_batch(self, queue, ct, batch_pks: list[str], reembed: bool) -> None:
        for pk in batch_pks:
            queue.enqueue(
                create_or_update_embedding,
                ct.id,
                pk,
                0,
                reembed,
            )

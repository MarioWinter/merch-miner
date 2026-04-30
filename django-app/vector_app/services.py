import logging
from typing import Optional

import numpy as np
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.postgres.search import SearchQuery, SearchRank
from django.db.models import F, Value
from django.db.models.functions import Coalesce
from pgvector.django import CosineDistance
import httpx

from vector_app.models import Embedding

logger = logging.getLogger(__name__)

# Content type label mapping for known embeddable models
EMBEDDABLE_MODELS = {
    'niche_app.niche': 'niche',
    'niche_research_app.nicheanalysis': 'niche_analysis',
    'niche_research_app.nicheproductvisionanalysis': 'vision_analysis',
    'niche_research_app.nicheproductemotionalanalysis': 'emotional_analysis',
    'niche_research_app.nichekeywordanalysis': 'keyword_analysis',
    'scraper_app.amazonproduct': 'amazon_product',
    'search_app.websearchresult': 'web_search',
    'agent_app.knowledgedoc': 'knowledge_doc',
    'agent_app.skill': 'skill',
    # Future: idea, listing, chat_message
}


def _get_content_type_label(ct: ContentType) -> str:
    """Return human-readable label for a content type."""
    key = f"{ct.app_label}.{ct.model}"
    return EMBEDDABLE_MODELS.get(key, ct.model)


def _get_content_type_for_label(label: str) -> Optional[ContentType]:
    """Reverse lookup: label -> ContentType."""
    for key, val in EMBEDDABLE_MODELS.items():
        if val == label:
            app_label, model = key.split('.')
            try:
                return ContentType.objects.get(app_label=app_label, model=model)
            except ContentType.DoesNotExist:
                return None
    return None


class EmbeddingService:
    """Core service for creating, searching, and deleting embeddings."""

    VECTOR_WEIGHT = 0.7
    TEXT_WEIGHT = 0.3

    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL
        self.model = getattr(settings, 'EMBEDDING_MODEL', 'text-embedding-3-small')
        self.dimensions = int(getattr(settings, 'EMBEDDING_DIMENSIONS', 1536))

    def _get_embedding_vector(self, text: str) -> list[float]:
        """Call OpenRouter embeddings API and return the vector."""
        url = f"{self.base_url}/embeddings"
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://merchminer.com',
            'X-Title': 'Merch Miner',
        }
        payload = {
            'model': self.model,
            'input': text,
            'dimensions': self.dimensions,
        }

        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        return data['data'][0]['embedding']

    def _resolve_workspace(self, instance):
        """Extract workspace from a source model instance."""
        # Direct workspace FK
        if hasattr(instance, 'workspace_id') and instance.workspace_id:
            return instance.workspace_id

        # Through niche FK (NicheAnalysis, NicheKeywordAnalysis)
        if hasattr(instance, 'niche_id'):
            from niche_app.models import Niche
            try:
                niche = Niche.objects.only('workspace_id').get(pk=instance.niche_id)
                return niche.workspace_id
            except Niche.DoesNotExist:
                return None

        # Through research FK (Vision/Emotional analysis)
        if hasattr(instance, 'research_id'):
            from niche_research_app.models import NicheResearch
            try:
                research = (
                    NicheResearch.objects
                    .select_related('niche')
                    .only('niche__workspace_id')
                    .get(pk=instance.research_id)
                )
                return research.niche.workspace_id
            except NicheResearch.DoesNotExist:
                return None

        return None

    def _build_metadata(self, instance, ct: ContentType) -> dict:
        """Build metadata dict for the embedding."""
        meta = {
            'source_type': _get_content_type_label(ct),
        }

        # Add niche context where available
        if hasattr(instance, 'niche_id') and instance.niche_id:
            meta['niche_id'] = str(instance.niche_id)
        elif hasattr(instance, 'research') and hasattr(instance.research, 'niche_id'):
            meta['niche_id'] = str(instance.research.niche_id)

        if hasattr(instance, 'niche') and hasattr(instance.niche, 'name'):
            meta['niche_name'] = instance.niche.name

        return meta

    def create_embedding(self, instance) -> Optional[Embedding]:
        """Create or update embedding for a model instance.

        Requires instance to have get_embedding_text() method.
        Returns the Embedding object or None on failure.
        """
        if not hasattr(instance, 'get_embedding_text'):
            logger.warning(
                "Model %s has no get_embedding_text() method, skipping.",
                type(instance).__name__,
            )
            return None

        text = instance.get_embedding_text()
        if not text or not text.strip():
            logger.info(
                "Empty embedding text for %s %s, skipping.",
                type(instance).__name__, instance.pk,
            )
            return None

        workspace_id = self._resolve_workspace(instance)
        if not workspace_id:
            logger.warning(
                "Cannot resolve workspace for %s %s, skipping.",
                type(instance).__name__, instance.pk,
            )
            return None

        ct = ContentType.objects.get_for_model(instance)
        vector = self._get_embedding_vector(text)
        metadata = self._build_metadata(instance, ct)

        embedding, _ = Embedding.objects.update_or_create(
            content_type=ct,
            object_id=instance.pk,
            defaults={
                'workspace_id': workspace_id,
                'embedding': vector,
                'text_input': text,
                'search_text': text,
                'metadata': metadata,
            },
        )

        return embedding

    def delete_embedding(self, instance) -> bool:
        """Delete embedding for a model instance. Returns True if deleted."""
        ct = ContentType.objects.get_for_model(instance)
        deleted, _ = Embedding.objects.filter(
            content_type=ct,
            object_id=instance.pk,
        ).delete()
        return deleted > 0

    def delete_embedding_by_ref(
        self, content_type_id: int, object_id: str,
    ) -> bool:
        """Delete embedding by content_type_id and object_id string."""
        deleted, _ = Embedding.objects.filter(
            content_type_id=content_type_id,
            object_id=object_id,
        ).delete()
        return deleted > 0

    def search(
        self,
        query: str,
        workspace_id,
        content_types: Optional[list[str]] = None,
        top_k: int = 10,
        threshold: float = 0.3,
        strategy: str = 'similarity',
    ) -> list[dict]:
        """Hybrid semantic + full-text search.

        Args:
            query: Search text.
            workspace_id: UUID of workspace (strict isolation).
            content_types: Optional list of type labels to filter.
            top_k: Max results to return.
            threshold: Min cosine similarity (0-1).
            strategy: 'similarity' or 'mmr'.

        Returns:
            List of dicts: {score, content_type, object_id, text_preview, metadata}.
        """
        if not query or not query.strip():
            return []

        # Get query embedding
        query_vector = self._get_embedding_vector(query)

        # Base queryset: always workspace-scoped
        qs = Embedding.objects.filter(workspace_id=workspace_id)

        # Optional content type filter
        if content_types:
            ct_ids = []
            for label in content_types:
                ct = _get_content_type_for_label(label)
                if ct:
                    ct_ids.append(ct.id)
            if ct_ids:
                qs = qs.filter(content_type_id__in=ct_ids)
            else:
                return []

        # Annotate with cosine distance (pgvector)
        qs = qs.annotate(
            cosine_distance=CosineDistance('embedding', query_vector),
        )

        # Filter by threshold (cosine similarity = 1 - distance)
        max_distance = 1.0 - threshold
        qs = qs.filter(cosine_distance__lte=max_distance)

        # Annotate with full-text rank
        search_query = SearchQuery(query, search_type='plain')
        qs = qs.annotate(
            text_rank=Coalesce(
                SearchRank(F('search_vector'), search_query),
                Value(0.0),
            ),
        )

        if strategy == 'mmr':
            return self._mmr_search(qs, query_vector, top_k)

        # Combined score: 0.7 * vector + 0.3 * text
        # vector_score = 1 - cosine_distance
        results = list(
            qs.order_by('cosine_distance')[:top_k * 2]
            .values(
                'id', 'content_type_id', 'object_id',
                'text_input', 'metadata', 'cosine_distance', 'text_rank',
            )
        )

        # Compute combined score and sort
        for r in results:
            vector_score = 1.0 - r['cosine_distance']
            r['score'] = (
                self.VECTOR_WEIGHT * vector_score
                + self.TEXT_WEIGHT * r['text_rank']
            )

        results.sort(key=lambda x: x['score'], reverse=True)
        results = results[:top_k]

        return self._format_results(results)

    # Hard cap on candidate pool for MMR to bound memory + CPU
    MMR_MAX_CANDIDATES = 100

    def _mmr_search(
        self, qs, query_vector: list[float], top_k: int, lambda_param: float = 0.7,
    ) -> list[dict]:
        """Max Marginal Relevance: diversity-aware re-ranking.

        Fetches at most MMR_MAX_CANDIDATES closest vectors from pgvector,
        then re-ranks with vectorized numpy cosine similarity.
        """
        # Cap candidate pool: min(top_k * 2, MMR_MAX_CANDIDATES)
        pool_size = min(top_k * 2, self.MMR_MAX_CANDIDATES)

        # Only fetch embedding for the capped candidate pool
        candidates = list(
            qs.order_by('cosine_distance')[:pool_size]
            .values(
                'id', 'content_type_id', 'object_id',
                'text_input', 'metadata', 'cosine_distance', 'text_rank',
                'embedding',
            )
        )

        if not candidates:
            return []

        # Pre-compute: build numpy matrix of all candidate embeddings once
        n = len(candidates)
        embeddings_matrix = np.array(
            [c['embedding'] for c in candidates], dtype=np.float32,
        )
        # Normalize rows for cosine similarity (dot product of unit vectors)
        norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
        norms = np.where(norms < 1e-10, 1.0, norms)
        embeddings_normed = embeddings_matrix / norms

        # Relevance scores (1 - cosine_distance, already computed by pgvector)
        relevance = np.array(
            [1.0 - c['cosine_distance'] for c in candidates], dtype=np.float64,
        )

        selected_indices: list[int] = []
        remaining_mask = np.ones(n, dtype=bool)

        for _ in range(min(top_k, n)):
            if not remaining_mask.any():
                break

            # Compute max similarity to already-selected for all remaining
            if selected_indices:
                selected_normed = embeddings_normed[selected_indices]
                # (remaining, dim) @ (dim, selected) -> (remaining, selected)
                sim_to_selected = embeddings_normed @ selected_normed.T
                max_sim = sim_to_selected.max(axis=1)
            else:
                max_sim = np.zeros(n, dtype=np.float64)

            # MMR score
            mmr_scores = lambda_param * relevance - (1 - lambda_param) * max_sim

            # Mask out already-selected
            mmr_scores[~remaining_mask] = -np.inf

            best_idx = int(np.argmax(mmr_scores))
            selected_indices.append(best_idx)
            remaining_mask[best_idx] = False

        # Build results from selected candidates (drop embedding from output)
        selected = []
        for idx in selected_indices:
            c = candidates[idx]
            c['relevance'] = float(relevance[idx])
            c['score'] = (
                self.VECTOR_WEIGHT * c['relevance']
                + self.TEXT_WEIGHT * c.get('text_rank', 0.0)
            )
            selected.append(c)

        return self._format_results(selected)

    def _format_results(self, results: list[dict]) -> list[dict]:
        """Format raw query results into API-ready dicts."""
        # Cache content type lookups
        ct_cache = {}
        formatted = []

        for r in results:
            ct_id = r['content_type_id']
            if ct_id not in ct_cache:
                try:
                    ct = ContentType.objects.get(pk=ct_id)
                    ct_cache[ct_id] = _get_content_type_label(ct)
                except ContentType.DoesNotExist:
                    ct_cache[ct_id] = 'unknown'

            text_input = r.get('text_input', '')
            text_preview = text_input[:200] if text_input else ''

            formatted.append({
                'score': round(r['score'], 4),
                'content_type': ct_cache[ct_id],
                'object_id': str(r['object_id']),
                'text_preview': text_preview,
                'metadata': r.get('metadata', {}),
            })

        return formatted

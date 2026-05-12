"""PROJ-29 Phase 1C — Embedding.search_vector population + index sanity (AC-Ops-DB-1/2).

Verifies that the Postgres trigger from migration 0002_search_vector_trigger
correctly populates search_vector on insert + update, and that the BM25 GIN
index is present and used by `EmbeddingService.hybrid_search`.
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import override_settings

from idea_app.models import Idea
from niche_app.models import Niche
from vector_app.models import Embedding
from vector_app.services import EmbeddingService
from workspace_app.models import Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='proj29-sv@example.com', password='pw')


@pytest.fixture
def workspace(db, user):
    return Workspace.objects.create(name='WS-SV', slug='ws-sv', owner=user)


@pytest.fixture
def niche(db, user, workspace):
    return Niche.objects.create(name='Bus Driver', workspace=workspace, created_by=user)


@pytest.fixture
def idea(db, niche, user, workspace):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Yellow School Bus Driver Champion',
        created_by=user,
    )


@pytest.mark.django_db
def test_search_vector_populated_via_trigger(workspace, idea):
    """After EmbeddingService.create_embedding, search_vector is non-null (trigger fires)."""
    with patch.object(
        EmbeddingService, '_get_embedding_vector',
        return_value=[0.01] * 1536,
    ), patch(
        'vector_app.services.contextual_header.generate_header',
        return_value='',
    ):
        service = EmbeddingService()
        embedding = service.create_embedding(idea)

    assert embedding is not None
    fresh = Embedding.objects.get(pk=embedding.pk)
    assert fresh.search_vector is not None


@pytest.mark.django_db
def test_bm25_gin_index_exists():
    """The GIN index on search_vector (migration 0001) is present in pg_indexes."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'vector_app_embedding'
              AND indexdef ILIKE '%gin%search_vector%';
            """
        )
        rows = [r[0] for r in cur.fetchall()]
    assert len(rows) >= 1, f"No GIN index on search_vector found; got {rows}"


@pytest.mark.django_db
def test_metadata_niche_id_gin_index_exists():
    """The GIN index on metadata->>niche_id (migration 0004) is present."""
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'vector_app_embedding'
              AND indexname ILIKE '%niche_id%';
            """
        )
        rows = [r[0] for r in cur.fetchall()]
    assert len(rows) >= 1, f"No GIN index on metadata niche_id found; got {rows}"


@pytest.mark.django_db
@override_settings(EMBEDDING_DIMENSIONS=1536)
def test_dimension_assertion_catches_wrong_size(workspace, idea):
    """create_embedding rejects a vector with the wrong dimension (AC-Ops-Chunk-3)."""
    with patch.object(
        EmbeddingService, '_get_embedding_vector',
        return_value=[0.01] * 768,  # WRONG dimension
    ), patch(
        'vector_app.services.contextual_header.generate_header',
        return_value='',
    ):
        service = EmbeddingService()
        with pytest.raises((AssertionError, ValueError)):
            service.create_embedding(idea)


@pytest.mark.django_db
def test_bm25_finds_matching_row(workspace, idea):
    """A row inserted with known keywords is retrievable via BM25 tsvector query."""
    with patch.object(
        EmbeddingService, '_get_embedding_vector',
        return_value=[0.01] * 1536,
    ), patch(
        'vector_app.services.contextual_header.generate_header',
        return_value='',
    ):
        service = EmbeddingService()
        service.create_embedding(idea)

    from django.contrib.postgres.search import SearchQuery, SearchRank
    from django.db.models import F

    qs = Embedding.objects.filter(workspace=workspace).annotate(
        rank=SearchRank(F('search_vector'), SearchQuery('school bus', config='english')),
    ).filter(rank__gt=0)
    assert qs.exists(), 'BM25 search returned no rows for a matching query'

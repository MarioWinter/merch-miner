"""PROJ-29 Phase 1C — EmbeddingService.hybrid_search.

Covers cross-workspace isolation, empty-corpus, RRF fusion ordering,
``content_subtypes`` filter, return-dict shape, and the
``search_vector`` auto-population path (trigger from migration 0002).
"""

import uuid
from unittest.mock import patch

import pytest

from vector_app.models import Embedding
from vector_app.services import EmbeddingService


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture
def User(db):
    from django.contrib.auth import get_user_model
    return get_user_model()


@pytest.fixture
def user_a(db, User):
    return User.objects.create_user(email='hs-a@test.com', password='pw')


@pytest.fixture
def user_b(db, User):
    return User.objects.create_user(email='hs-b@test.com', password='pw')


@pytest.fixture
def workspace_a(db, user_a):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='WS-A', slug='ws-a', owner=user_a)


@pytest.fixture
def workspace_b(db, user_b):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='WS-B', slug='ws-b', owner=user_b)


@pytest.fixture
def niche_a(db, workspace_a, user_a):
    from niche_app.models import Niche
    return Niche.objects.create(
        name='Fishing Humor', notes='', workspace=workspace_a, created_by=user_a,
    )


@pytest.fixture
def niche_b(db, workspace_b, user_b):
    from niche_app.models import Niche
    return Niche.objects.create(
        name='Hiking Humor', notes='', workspace=workspace_b, created_by=user_b,
    )


@pytest.fixture
def mock_vector():
    return [0.01 * i for i in range(1536)]


def _make_embedding(workspace, niche=None, content_subtype='slogan', text='hello world'):
    """Insert an Embedding row directly. search_vector populated by Postgres trigger."""
    from django.contrib.contenttypes.models import ContentType
    from idea_app.models import Idea
    ct = ContentType.objects.get_for_model(Idea)
    meta = {'content_subtype': content_subtype, 'source_type': 'idea'}
    if niche is not None:
        meta['niche_id'] = str(niche.id)
        meta['niche_name'] = niche.name
    return Embedding.objects.create(
        content_type=ct,
        object_id=uuid.uuid4(),
        workspace=workspace,
        embedding=[0.1] * 1536,
        text_input=text,
        search_text=text,
        metadata=meta,
    )


# ── search_vector population path (prerequisite for BM25) ───────────────────


@pytest.mark.django_db
class TestSearchVectorPopulation:
    def test_trigger_populates_search_vector_on_insert(self, workspace_a):
        """Postgres BEFORE-INSERT trigger from 0002 must set search_vector."""
        emb = _make_embedding(workspace_a, text='kayak fishing tournament')
        emb.refresh_from_db()
        assert emb.search_vector is not None
        # tsvector repr contains the lexemes
        assert 'kayak' in str(emb.search_vector)

    def test_bm25_query_finds_matching_row(self, workspace_a, niche_a, mock_vector):
        """tsvector @@ tsquery returns the row for a matching lexeme."""
        from django.contrib.postgres.search import SearchQuery, SearchRank
        from django.db.models import F
        _make_embedding(workspace_a, niche=niche_a, text='trout fishing morning')
        qs = Embedding.objects.filter(workspace=workspace_a).annotate(
            rank=SearchRank(
                F('search_vector'),
                SearchQuery('trout', config='english'),
            ),
        ).filter(rank__gt=0)
        assert qs.count() == 1


# ── hybrid_search behaviour ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestHybridSearchIsolation:
    def test_empty_corpus_returns_empty_list(self, workspace_a, mock_vector):
        service = EmbeddingService()
        with patch.object(
            EmbeddingService, '_get_embedding_vector',
            return_value=mock_vector,
        ):
            results = service.hybrid_search(
                workspace=workspace_a, query='anything',
            )
        assert results == []

    def test_empty_query_returns_empty_list(self, workspace_a):
        service = EmbeddingService()
        assert service.hybrid_search(workspace=workspace_a, query='') == []
        assert service.hybrid_search(workspace=workspace_a, query='   ') == []

    def test_workspace_none_raises_permission_error(self):
        service = EmbeddingService()
        with pytest.raises(PermissionError):
            service.hybrid_search(workspace=None, query='x')

    def test_cross_workspace_niche_raises_permission_error(
        self, workspace_a, niche_b, mock_vector,
    ):
        """Niche from workspace B referenced via filters while querying as workspace A."""
        service = EmbeddingService()
        with pytest.raises(PermissionError):
            service.hybrid_search(
                workspace=workspace_a,
                query='hi',
                filters={'metadata__niche_id': str(niche_b.id)},
            )


@pytest.mark.django_db
class TestHybridSearchFusion:
    def test_returns_5_key_dict_shape(self, workspace_a, niche_a, mock_vector):
        _make_embedding(workspace_a, niche=niche_a, text='fishing slogan one')
        service = EmbeddingService()
        with patch.object(
            EmbeddingService, '_get_embedding_vector',
            return_value=mock_vector,
        ), patch(
            'agent_app.services.query_rewriter.rewrite',
            side_effect=lambda q, **kw: q,
        ):
            results = service.hybrid_search(
                workspace=workspace_a, query='fishing',
            )
        assert len(results) == 1
        row = results[0]
        assert set(row.keys()) == {
            'text', 'content_subtype', 'source_pk', 'score', 'metadata',
        }
        assert row['content_subtype'] == 'slogan'
        assert row['text'] == 'fishing slogan one'

    def test_content_subtypes_filter_excludes_others(
        self, workspace_a, niche_a, mock_vector,
    ):
        _make_embedding(workspace_a, niche=niche_a, content_subtype='slogan',
                        text='fishing slogan')
        _make_embedding(workspace_a, niche=niche_a, content_subtype='notes',
                        text='fishing notes')
        service = EmbeddingService()
        with patch.object(
            EmbeddingService, '_get_embedding_vector',
            return_value=mock_vector,
        ), patch(
            'agent_app.services.query_rewriter.rewrite',
            side_effect=lambda q, **kw: q,
        ):
            results = service.hybrid_search(
                workspace=workspace_a, query='fishing',
                content_subtypes=['slogan'],
            )
        assert len(results) == 1
        assert results[0]['content_subtype'] == 'slogan'

    def test_rrf_prefers_double_ranked_chunk(self, workspace_a, niche_a, mock_vector):
        """A chunk that appears in BOTH paths must outscore single-path chunks.

        Stubs `_get_embedding_vector` (vector path) and shapes the BM25 path
        with distinct search_text so only one row matches. We then assert
        the dual-path chunk ranks first.
        """
        # Row 1 — matches BM25 ('mountain' lexeme) AND vector path.
        e1 = _make_embedding(
            workspace_a, niche=niche_a, text='mountain peak adventure',
        )
        # Row 2 — only the vector path (no 'mountain' lexeme).
        e2 = _make_embedding(
            workspace_a, niche=niche_a, text='valley river calm',
        )

        # Vector path returns [e1, e2] in that order (e1 first). BM25 path
        # returns only e1 (matches 'mountain'). RRF must rank e1 first.
        service = EmbeddingService()

        # Mock cosine so e1 (smaller distance) ranks first in vector path.
        def fake_get_vec(_text):
            return mock_vector

        with patch.object(
            EmbeddingService, '_get_embedding_vector', side_effect=fake_get_vec,
        ), patch(
            'agent_app.services.query_rewriter.rewrite',
            side_effect=lambda q, **kw: q,
        ):
            # Manually set distinct embeddings so vector ordering is e1 then e2.
            e1.embedding = mock_vector  # exact match -> distance 0
            e1.save()
            far = [v + 0.5 for v in mock_vector]
            e2.embedding = far
            e2.save()

            results = service.hybrid_search(
                workspace=workspace_a, query='mountain',
            )

        assert len(results) >= 1
        assert results[0]['source_pk'] == str(e1.object_id)
        # e1 is rank-1 in vector + rank-1 in BM25, so its RRF score is
        # 1/(60+1) + 1/(60+1) = 2/61. e2 only appears in vector at rank 2:
        # 1/(60+2) = 1/62. So e1 > e2 strictly.
        if len(results) == 2:
            assert results[0]['score'] > results[1]['score']


# ── Dimension assertion (AC-Ops-Chunk-3) ────────────────────────────────────


@pytest.mark.django_db
class TestDimensionAssertion:
    def test_wrong_dim_raises_runtime_error(self, workspace_a, niche_a):
        """create_embedding must reject wrong-dim vectors before writing to DB."""
        from idea_app.models import Idea
        idea = Idea.objects.create(
            workspace=workspace_a, niche=niche_a,
            slogan_text='dim-test slogan',
            created_by=workspace_a.owner,
        )
        service = EmbeddingService()
        wrong_dim = [0.0] * 768  # text-embedding-3-small is 1536
        with patch.object(
            EmbeddingService, '_get_embedding_vector', return_value=wrong_dim,
        ):
            with pytest.raises(RuntimeError) as exc:
                service.create_embedding(idea)
        msg = str(exc.value)
        assert 'dimension mismatch' in msg.lower()
        assert '768' in msg
        assert '1536' in msg


# ── Index existence (smoke variant of EXPLAIN-ANALYZE, AC-Ops-DB-1/2) ────────


@pytest.mark.django_db
class TestRetrievalIndexes:
    """Verifies the BM25 + niche_id GIN indexes from migrations exist.

    Cheap proxy for AC-Ops-DB-1/2 + Verification 25. A full EXPLAIN-ANALYZE
    on a 1k-row dataset is gated as a separate slow test; this fast variant
    catches the most common regression (index dropped or never created).
    """

    def test_search_vector_gin_index_present(self):
        from django.db import connection
        with connection.cursor() as cur:
            cur.execute(
                "SELECT indexname FROM pg_indexes "
                "WHERE tablename = 'vector_app_embedding';"
            )
            names = {row[0] for row in cur.fetchall()}
        # From migration 0001_initial (emb_search_gin_idx) — covers BM25 path.
        assert 'emb_search_gin_idx' in names
        # PROJ-29 Phase 1C — niche_id GIN from migration 0004.
        assert 'embedding_metadata_niche_id_gin' in names

    def test_bm25_path_uses_indexed_lookup(self, workspace_a, niche_a, mock_vector):
        """End-to-end smoke: known-matching lexeme finds the row via SearchRank."""
        _make_embedding(workspace_a, niche=niche_a, text='unique-lexeme-xyz')
        service = EmbeddingService()
        with patch.object(
            EmbeddingService, '_get_embedding_vector', return_value=mock_vector,
        ), patch(
            'agent_app.services.query_rewriter.rewrite',
            side_effect=lambda q, **kw: q,
        ):
            results = service.hybrid_search(
                workspace=workspace_a, query='unique-lexeme-xyz',
            )
        # If BM25 returned 0 rows, search_vector wasn't populated -> trigger broken.
        assert len(results) == 1

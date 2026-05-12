"""PROJ-29 Phase 1B Round 1: content_subtype metadata enrichment."""

from unittest.mock import patch

import pytest
from django.contrib.contenttypes.models import ContentType

from vector_app.services import (
    EmbeddingService,
    _CONTENT_SUBTYPE_MAP,
    _resolve_content_subtype,
)


@pytest.fixture
def workspace(db):
    from django.contrib.auth import get_user_model
    from workspace_app.models import Workspace
    User = get_user_model()
    user = User.objects.create_user(email='subtype@test.com', password='testpass123')
    return Workspace.objects.create(name='Subtype WS', slug='subtype-ws', owner=user)


@pytest.fixture
def niche(db, workspace):
    from django.contrib.auth import get_user_model
    from niche_app.models import Niche
    user = get_user_model().objects.first()
    return Niche.objects.create(
        name='Hiking',
        notes='hiking shirts',
        workspace=workspace,
        created_by=user,
    )


@pytest.fixture
def user(db):
    return __import__('django.contrib.auth', fromlist=['get_user_model']).get_user_model().objects.first()


@pytest.fixture
def mock_embedding_vector():
    return [0.01 * i for i in range(1536)]


@pytest.mark.django_db
class TestContentSubtypeMap:
    def test_idea_subtype(self):
        from idea_app.models import Idea
        ct = ContentType.objects.get_for_model(Idea)
        assert _resolve_content_subtype(ct) == 'slogan'

    def test_nichenote_subtype(self):
        from niche_app.models import NicheNote
        ct = ContentType.objects.get_for_model(NicheNote)
        assert _resolve_content_subtype(ct) == 'notes'

    def test_collected_product_subtype(self):
        from niche_app.models import CollectedProduct
        ct = ContentType.objects.get_for_model(CollectedProduct)
        assert _resolve_content_subtype(ct) == 'product'

    def test_amazon_product_subtype(self):
        from scraper_app.models import AmazonProduct
        ct = ContentType.objects.get_for_model(AmazonProduct)
        assert _resolve_content_subtype(ct) == 'product'

    def test_unknown_subtype_fallback(self):
        # Niche is intentionally NOT in the map (only sub-entities are).
        from niche_app.models import Niche
        ct = ContentType.objects.get_for_model(Niche)
        assert _resolve_content_subtype(ct) == 'unknown'

    def test_keyword_analysis_subtype(self):
        # Confirms the niche_research_app entries resolve correctly.
        from niche_research_app.models import NicheKeywordAnalysis
        ct = ContentType.objects.get_for_model(NicheKeywordAnalysis)
        assert _resolve_content_subtype(ct) == 'keyword_analysis'

    def test_map_keys_are_tuples(self):
        for key in _CONTENT_SUBTYPE_MAP.keys():
            assert isinstance(key, tuple)
            assert len(key) == 2


@pytest.mark.django_db
class TestBuildMetadataContentSubtype:
    def test_idea_metadata_has_subtype(self, workspace, niche, user, mock_embedding_vector):
        from idea_app.models import Idea
        idea = Idea.objects.create(
            workspace=workspace,
            niche=niche,
            slogan_text='Hike More Worry Less',
            why_it_works='Identity declaration for hikers.',
            buyer_voice_pattern='I am a hiker',
            is_manual=True,
            created_by=user,
        )

        service = EmbeddingService()
        with patch.object(service, '_get_embedding_vector', return_value=mock_embedding_vector):
            result = service.create_embedding(idea)

        assert result is not None
        assert result.metadata.get('content_subtype') == 'slogan'
        assert result.metadata.get('niche_id') == str(niche.pk)

    def test_nichenote_metadata_has_subtype(self, workspace, niche, user, mock_embedding_vector):
        from niche_app.models import NicheNote
        note = NicheNote.objects.create(
            niche=niche,
            text='hikers love mountains',
            created_by=user,
        )

        service = EmbeddingService()
        with patch.object(service, '_get_embedding_vector', return_value=mock_embedding_vector):
            result = service.create_embedding(note)

        assert result is not None
        assert result.metadata.get('content_subtype') == 'notes'
        assert result.metadata.get('niche_id') == str(niche.pk)

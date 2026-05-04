"""Tests for publish_app services."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import (
    DesignAsset,
    Listing,
    ProductLifecycle,
    UploadJob,
)
from publish_app.services.lifecycle_tracker import (
    create_or_update_lifecycle,
    get_niche_lifecycle,
)
from workspace_app.models import Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='svc@example.com', password='testpass123')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='Svc WS', slug='svc-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Cat Niches', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='I Love My Cat', created_by=user,
    )


@pytest.fixture
def listing(workspace, idea):
    return Listing.objects.create(
        workspace=workspace, idea=idea,
        brand_name='CatCo', title='Cat Lovers Unite',
        bullet_1='Premium cotton', description='For cat enthusiasts',
        keyword_context='cat, lover, tshirt',
    )


class TestLifecycleTracker:
    def test_get_empty_lifecycle(self, niche, workspace):
        result = get_niche_lifecycle(niche.id, workspace.id)
        assert result == []

    def test_get_lifecycle_grouped_by_round(self, workspace, niche, idea, listing, user):
        design = DesignAsset.objects.create(
            workspace=workspace, file_name='d1.png', created_by=user,
        )
        ProductLifecycle.objects.create(
            workspace=workspace, niche=niche, idea=idea,
            design=design, listing=listing,
            asin='B0ROUND1', marketplace='amazon.com', round=1,
        )
        ProductLifecycle.objects.create(
            workspace=workspace, niche=niche,
            asin='B0ROUND2', marketplace='amazon.de', round=2,
        )
        result = get_niche_lifecycle(niche.id, workspace.id)
        assert len(result) == 2
        assert result[0]['round'] == 1
        assert result[1]['round'] == 2
        assert result[0]['chains'][0]['asin'] == 'B0ROUND1'

    def test_create_lifecycle_on_upload_complete(self, workspace, niche, idea, listing, user):
        design = DesignAsset.objects.create(
            workspace=workspace, file_name='d2.png', created_by=user,
        )
        from django.utils import timezone
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing, design=design,
            marketplace='amazon.com', created_by=user,
            status=UploadJob.Status.COMPLETED,
            asin='B0NEW123',
            completed_at=timezone.now(),
        )
        lc = create_or_update_lifecycle(job)
        assert lc is not None
        assert lc.asin == 'B0NEW123'
        assert lc.marketplace == 'amazon.com'

    def test_no_lifecycle_without_asin(self, workspace, listing, user):
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.com', created_by=user,
            status=UploadJob.Status.PENDING,
        )
        lc = create_or_update_lifecycle(job)
        assert lc is None


class TestTranslator:
    @patch('publish_app.services.translator.ChatOpenAI')
    def test_translate_listing(self, mock_llm_cls, listing):
        from publish_app.services.translator import translate_listing

        mock_response = MagicMock()
        mock_response.content = '''{
            "title": "Katzenliebhaber vereint euch",
            "bullet_1": "Premium Baumwolle",
            "bullet_2": "",
            "description": "Fuer Katzen-Fans",
            "over_limit_fields": []
        }'''
        mock_llm = MagicMock()
        mock_llm.invoke.return_value = mock_response
        mock_llm_cls.return_value = mock_llm

        result = translate_listing(listing, 'de')
        assert result['title'] == 'Katzenliebhaber vereint euch'
        assert result['over_limit_fields'] == []

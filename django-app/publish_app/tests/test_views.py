"""Tests for publish_app API views."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import (
    DesignAsset,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='test@example.com', password='testpass123')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)


@pytest.fixture
def membership(workspace, user):
    return Membership.objects.create(
        workspace=workspace, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Test Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Funny Cat Saying', created_by=user,
    )


@pytest.fixture
def design_asset(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='cat_design.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def listing(workspace, idea, design_asset):
    return Listing.objects.create(
        workspace=workspace, idea=idea, design=design_asset,
        brand_name='CatBrand', title='Funny Cat T-Shirt',
        bullet_1='Super soft cotton', bullet_2='Great gift idea',
        description='A hilarious cat design',
        keyword_context='cat, funny, tshirt',
    )


@pytest.fixture
def upload_template(workspace, user):
    return UploadTemplate.objects.create(
        workspace=workspace, name='Standard',
        brand_name='CatBrand', created_by=user,
        products_config=[
            {
                'product_type': 'standard_tshirt',
                'enabled': True,
                'fit_types': ['men'],
                'print_side': 'front',
                'colors': ['black'],
                'marketplaces': [
                    {
                        'marketplace': 'amazon.com',
                        'price': '19.99',
                        'enabled': True,
                    },
                ],
            },
        ],
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# Listing API Tests
# ---------------------------------------------------------------------------

class TestListingDetailView:
    def test_get_listing(self, api_client, workspace, listing, membership):
        resp = api_client.get(
            f'/api/ideas/{listing.idea_id}/listing/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['title'] == 'Funny Cat T-Shirt'

    def test_get_listing_not_found(self, api_client, workspace, membership):
        fake_id = uuid.uuid4()
        resp = api_client.get(
            f'/api/ideas/{fake_id}/listing/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404


class TestListingUpdateView:
    def test_update_listing(self, api_client, workspace, listing, membership):
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'title': 'Updated Cat Title'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['title'] == 'Updated Cat Title'
        # Status reverts to draft on content edit
        assert resp.data['status'] == 'draft'

    def test_update_listing_status_only(self, api_client, workspace, listing, membership):
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'status': 'ready'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'ready'

    def test_keyword_context_patch_does_not_revert_status(
        self, api_client, workspace, listing, membership,
    ):
        """EC-42: editing keyword_context on a Ready listing must NOT
        revert status to draft (unlike other content fields).
        """
        # First, mark listing as Ready.
        listing.status = Listing.Status.READY
        listing.save(update_fields=['status'])

        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keyword_context': 'new, hint, words'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['keyword_context'] == 'new, hint, words'
        # EC-42: status must remain `ready`, NOT flip back to `draft`.
        assert resp.data['status'] == 'ready'


class TestListingExportView:
    def test_export_listing(self, api_client, workspace, listing, membership):
        resp = api_client.get(
            f'/api/listings/{listing.id}/export/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert 'Funny Cat T-Shirt' in resp.data['text']
        assert 'CatBrand' in resp.data['text']


class TestListingTranslateView:
    @patch('publish_app.api.views.django_rq')
    def test_translate_listing(self, mock_rq, api_client, workspace, listing, membership):
        mock_queue = MagicMock()
        mock_rq.get_queue.return_value = mock_queue

        resp = api_client.post(
            f'/api/listings/{listing.id}/translate/',
            {'target_languages': ['de', 'fr']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 202
        mock_queue.enqueue.assert_called_once()


# ---------------------------------------------------------------------------
# Design Gallery API Tests
# ---------------------------------------------------------------------------

class TestDesignGalleryListView:
    def test_list_gallery(self, api_client, workspace, design_asset, membership):
        resp = api_client.get(
            '/api/designs/gallery/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_list_gallery_filter_source(self, api_client, workspace, design_asset, membership):
        resp = api_client.get(
            '/api/designs/gallery/?source=upload',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_list_gallery_filter_no_listing(self, api_client, workspace, design_asset, membership):
        resp = api_client.get(
            '/api/designs/gallery/?has_listing=false',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1


class TestDesignGalleryDetailView:
    def test_delete_design(self, api_client, workspace, design_asset, membership):
        resp = api_client.delete(
            f'/api/designs/gallery/{design_asset.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not DesignAsset.objects.filter(pk=design_asset.id).exists()

    def test_update_design_tags(self, api_client, workspace, design_asset, membership):
        resp = api_client.patch(
            f'/api/designs/gallery/{design_asset.id}/',
            {'tags': ['cat', 'funny']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['tags'] == ['cat', 'funny']


class TestDesignGalleryBulkActionView:
    def test_bulk_delete(self, api_client, workspace, design_asset, membership):
        resp = api_client.post(
            '/api/designs/gallery/bulk-action/',
            {'ids': [str(design_asset.id)], 'action': 'delete'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['deleted'] == 1


# ---------------------------------------------------------------------------
# Upload Job API Tests
# ---------------------------------------------------------------------------

class TestUploadJobCreateView:
    def test_create_job(self, api_client, workspace, listing, design_asset, membership):
        resp = api_client.post(
            '/api/upload-jobs/',
            {
                'listing_id': str(listing.id),
                'design_id': str(design_asset.id),
                'marketplace': 'amazon.com',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['status'] == 'pending'
        assert resp.data['marketplace'] == 'amazon.com'
        assert 'Funny Cat T-Shirt' in resp.data['listing_snapshot']['title']

    def test_create_job_no_title(self, api_client, workspace, idea, membership):
        empty_listing = Listing.objects.create(
            workspace=workspace, idea=idea,
        )
        resp = api_client.post(
            '/api/upload-jobs/',
            {'listing_id': str(empty_listing.id), 'marketplace': 'amazon.com'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400


class TestUploadJobListView:
    def test_list_jobs(self, api_client, workspace, listing, user, membership):
        UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.com', created_by=user,
        )
        resp = api_client.get(
            '/api/upload-jobs/list/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1


class TestUploadJobCancelView:
    def test_cancel_pending_job(self, api_client, workspace, listing, user, membership):
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.com', created_by=user,
        )
        resp = api_client.post(
            f'/api/upload-jobs/{job.id}/cancel/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'cancelled'

    def test_cannot_cancel_completed(self, api_client, workspace, listing, user, membership):
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.com', created_by=user,
            status=UploadJob.Status.COMPLETED,
        )
        resp = api_client.post(
            f'/api/upload-jobs/{job.id}/cancel/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400


class TestUploadJobStatusUpdateView:
    def test_update_status_to_completed(self, api_client, workspace, listing, user, membership):
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.com', created_by=user,
        )
        resp = api_client.patch(
            f'/api/upload-jobs/{job.id}/status/',
            {'status': 'completed', 'asin': 'B0TEST123'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['asin'] == 'B0TEST123'
        assert resp.data['status'] == 'completed'


# ---------------------------------------------------------------------------
# Upload Template API Tests
# ---------------------------------------------------------------------------

class TestUploadTemplateListCreateView:
    def test_create_template(self, api_client, workspace, membership):
        resp = api_client.post(
            '/api/upload-templates/',
            {
                'name': 'My Template',
                'brand_name': 'TestBrand',
                'products_config': [
                    {
                        'product_type': 'standard_tshirt',
                        'enabled': True,
                        'fit_types': ['men'],
                        'print_side': 'front',
                        'colors': ['black'],
                        'marketplaces': [
                            {
                                'marketplace': 'amazon.com',
                                'price': 19.99,
                                'enabled': True,
                            },
                        ],
                    },
                ],
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert resp.data['name'] == 'My Template'
        assert resp.data['products_config'][0]['product_type'] == (
            'standard_tshirt'
        )

    def test_list_templates(self, api_client, workspace, upload_template, membership):
        resp = api_client.get(
            '/api/upload-templates/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1


class TestUploadTemplateDetailView:
    def test_get_template(self, api_client, workspace, upload_template, membership):
        resp = api_client.get(
            f'/api/upload-templates/{upload_template.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'Standard'

    def test_update_template(self, api_client, workspace, upload_template, membership):
        resp = api_client.patch(
            f'/api/upload-templates/{upload_template.id}/',
            {'name': 'Updated'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'Updated'

    def test_delete_template(self, api_client, workspace, upload_template, membership):
        resp = api_client.delete(
            f'/api/upload-templates/{upload_template.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Product Lifecycle API Tests
# ---------------------------------------------------------------------------

class TestNicheLifecycleView:
    def test_get_lifecycle(self, api_client, workspace, niche, idea, design_asset, listing, membership):
        ProductLifecycle.objects.create(
            workspace=workspace, niche=niche, idea=idea,
            design=design_asset, listing=listing,
            asin='B0TEST123', marketplace='amazon.com', round=1,
        )
        resp = api_client.get(
            f'/api/niches/{niche.id}/lifecycle/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['niche_id'] == str(niche.id)
        assert len(resp.data['rounds']) == 1
        assert resp.data['rounds'][0]['round'] == 1

    def test_lifecycle_empty(self, api_client, workspace, niche, membership):
        resp = api_client.get(
            f'/api/niches/{niche.id}/lifecycle/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['rounds'] == []


class TestLifecycleUpdateView:
    def test_update_sales_data(self, api_client, workspace, niche, membership):
        lc = ProductLifecycle.objects.create(
            workspace=workspace, niche=niche,
            asin='B0TEST123', marketplace='amazon.com',
        )
        resp = api_client.patch(
            f'/api/lifecycle/{lc.id}/',
            {'sales_units': 42, 'current_bsr': 150000},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['sales_units'] == 42
        assert resp.data['current_bsr'] == 150000


# ---------------------------------------------------------------------------
# Workspace Isolation Tests
# ---------------------------------------------------------------------------

class TestWorkspaceIsolation:
    def test_cannot_access_other_workspace_listing(self, api_client, listing, membership):
        other_user = User.objects.create_user(email='other@example.com', password='pass')
        other_ws = Workspace.objects.create(name='Other', slug='other', owner=other_user)

        resp = api_client.get(
            f'/api/listings/{listing.id}/export/',
            HTTP_X_WORKSPACE_ID=str(other_ws.id),
        )
        assert resp.status_code == 404

    def test_cannot_access_other_workspace_jobs(self, api_client, workspace, listing, user, membership):
        other_user = User.objects.create_user(email='other2@example.com', password='pass')
        other_ws = Workspace.objects.create(name='Other2', slug='other2', owner=other_user)
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.com', created_by=user,
        )
        resp = api_client.get(
            f'/api/upload-jobs/{job.id}/',
            HTTP_X_WORKSPACE_ID=str(other_ws.id),
        )
        assert resp.status_code == 404

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

    def test_ec14_concurrent_patches_last_write_wins(
        self, api_client, workspace, listing, membership,
    ):
        """EC-14: two PATCHes targeting the same Listing from different
        tabs (same user) must both succeed; the later one wins without
        DB-level integrity errors or 409s. MVP has no optimistic locking —
        this test locks in the documented last-write-wins semantics so a
        future introduction of an ETag/version header is a visible breaking
        change rather than silent."""
        resp_a = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'title': 'Tab A'},
            format='json',
            **ws_headers(workspace),
        )
        resp_b = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'title': 'Tab B'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
        listing.refresh_from_db()
        assert listing.title == 'Tab B'

    def test_translations_patch_persists_and_does_not_revert_status(
        self, api_client, workspace, listing, membership,
    ):
        """Round 5: per-language title/bullet/description edits PATCH into
        the translations JSONField, preserve EN top-level copy, and must
        NOT revert a Ready listing to draft (translations aren't one of the
        five "content" fields — same rule as keyword_context / EC-42)."""
        listing.status = Listing.Status.READY
        listing.save(update_fields=['status'])

        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {
                'translations': {
                    'de': {
                        'title': 'Deutsche Variante',
                        'bullet_1': 'DE Bullet 1',
                        'bullet_2': 'DE Bullet 2',
                        'description': 'Deutsche Beschreibung',
                    },
                },
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'ready'
        assert resp.data['translations']['de']['title'] == 'Deutsche Variante'
        # EN top-level fields stay intact.
        assert resp.data['title'] == 'Funny Cat T-Shirt'
        assert resp.data['brand_name'] == 'CatBrand'

    def test_ec14_concurrent_disjoint_field_patches_both_land(
        self, api_client, workspace, listing, membership,
    ):
        """EC-14 companion: when Tab A PATCHes title and Tab B PATCHes
        description — both land. The serializer-level partial update path
        must not wipe fields it didn't touch."""
        resp_a = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'title': 'Shared Title'},
            format='json',
            **ws_headers(workspace),
        )
        resp_b = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'description': 'Shared Description'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp_a.status_code == 200
        assert resp_b.status_code == 200
        listing.refresh_from_db()
        assert listing.title == 'Shared Title'
        assert listing.description == 'Shared Description'


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
# AI Improve API Tests (PROJ-11 Phase M2)
# ---------------------------------------------------------------------------

class TestListingAIImproveView:
    """POST /api/listings/{id}/ai-improve/ -- AC-69..AC-72, EC-31, EC-33."""

    def _patch_pipeline(
        self,
        *,
        vision_context=None,
        llm_response=None,
        validated_fields=None,
        truncated=None,
        llm_raises=False,
    ):
        """Build a stack of patches for the M1 pipeline helpers.

        Returns a list of ``unittest.mock.patch`` objects that the caller
        enters via ``ExitStack`` or ``contextlib.ExitStack``. All M1 helpers
        are mocked so the view never hits OpenRouter.
        """
        vision_context = vision_context or {
            'description': 'cat silhouette',
            'visual_style': 'retro',
            'graphic_elements': 'cat',
            'layout_composition': 'centered',
            'dominant_colors': ['#000'],
            'detected_text': '',
            'analyzed_at': '2026-04-23T10:00:00+00:00',
            'model': 'openai/gpt-4.1-mini',
        }
        llm_response = llm_response or {
            'title': 'New Title',
            'bullet_1': 'New B1',
            'bullet_2': 'New B2',
            'description': 'New description.',
            'keyword_context': 'new, kw',
        }
        validated_fields = validated_fields or llm_response
        truncated = truncated if truncated is not None else []

        call_llm_mock = (
            MagicMock(side_effect=Exception('boom'))
            if llm_raises
            else MagicMock(return_value=llm_response)
        )

        return {
            'ensure_design_vision': patch(
                'publish_app.api.views.ensure_design_vision',
                return_value=vision_context,
            ),
            'build_prompt': patch(
                'publish_app.api.views.build_prompt',
                return_value=[
                    {'role': 'system', 'content': 'sys'},
                    {'role': 'user', 'content': 'usr'},
                ],
            ),
            'call_llm': patch(
                'publish_app.api.views.call_llm',
                new=call_llm_mock,
            ),
            'validate_and_truncate': patch(
                'publish_app.api.views.validate_and_truncate',
                return_value=(validated_fields, truncated),
            ),
        }

    def test_happy_path_returns_updated_listing(
        self, api_client, workspace, listing, membership,
    ):
        """AC-69..AC-72: 200 with {listing, truncated_fields}; persisted."""
        patches = self._patch_pipeline(
            validated_fields={
                'title': 'AI Title',
                'bullet_1': 'AI B1',
                'bullet_2': 'AI B2',
                'description': 'AI description of the design.',
                'keyword_context': 'ai, kw, hints',
            },
            truncated=['description'],
        )
        with patches['ensure_design_vision'], patches['build_prompt'], \
                patches['call_llm'], patches['validate_and_truncate']:
            resp = api_client.post(
                f'/api/listings/{listing.id}/ai-improve/',
                {},
                format='json',
                **ws_headers(workspace),
            )

        assert resp.status_code == 200
        assert 'listing' in resp.data
        assert 'truncated_fields' in resp.data
        assert resp.data['truncated_fields'] == ['description']
        assert resp.data['listing']['title'] == 'AI Title'
        assert resp.data['listing']['description'] == (
            'AI description of the design.'
        )
        # apply_to_listing sets generated_by='ai' and reverts status to draft.
        assert resp.data['listing']['generated_by'] == 'ai'
        assert resp.data['listing']['status'] == 'draft'

        # DB-level assertion that the save actually landed.
        listing.refresh_from_db()
        assert listing.title == 'AI Title'
        assert listing.generated_by == Listing.GeneratedBy.AI

    def test_returns_400_when_design_is_null(
        self, api_client, workspace, idea, membership,
    ):
        """EC-31: AI Improve requires a linked design asset."""
        orphan = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            brand_name='X', title='X',
        )
        patches = self._patch_pipeline()
        # None of the pipeline helpers should be called -- guard fires first.
        with patches['ensure_design_vision'] as ensure_mock, \
                patches['build_prompt'], patches['call_llm'], \
                patches['validate_and_truncate']:
            resp = api_client.post(
                f'/api/listings/{orphan.id}/ai-improve/',
                {},
                format='json',
                **ws_headers(workspace),
            )

        assert resp.status_code == 400
        assert resp.data == {
            'error': 'AI Improve requires a linked design asset',
        }
        ensure_mock.assert_not_called()

    def test_returns_502_when_llm_raises_and_listing_unchanged(
        self, api_client, workspace, listing, membership,
    ):
        """EC-33: LLM failure -> 502; listing row must be unchanged in DB."""
        from publish_app.services.ai_improve import AIImproveError

        # Snapshot the pre-call state for post-call equality assertions.
        before = {
            'title': listing.title,
            'bullet_1': listing.bullet_1,
            'bullet_2': listing.bullet_2,
            'description': listing.description,
            'keyword_context': listing.keyword_context,
            'status': listing.status,
            'generated_by': listing.generated_by,
        }

        patches = self._patch_pipeline()
        # Swap in a raising call_llm that mimics the real service contract.
        raising = patch(
            'publish_app.api.views.call_llm',
            side_effect=AIImproveError('LLM upstream call failed'),
        )
        with patches['ensure_design_vision'], patches['build_prompt'], \
                raising, patches['validate_and_truncate']:
            resp = api_client.post(
                f'/api/listings/{listing.id}/ai-improve/',
                {},
                format='json',
                **ws_headers(workspace),
            )

        assert resp.status_code == 502
        # Q3=A: generic message; raw exception goes to the logs only.
        assert resp.data == {'error': 'AI Improve LLM call failed'}

        listing.refresh_from_db()
        for key, value in before.items():
            assert getattr(listing, key) == value, (
                f'listing.{key} was modified despite 502'
            )

    def test_returns_404_on_cross_workspace_listing(
        self, api_client, listing, membership,
    ):
        """Workspace isolation: listing belongs to ws A, request sent with ws B."""
        other_user = User.objects.create_user(
            email='ai-improve-other@example.com', password='pass',
        )
        other_ws = Workspace.objects.create(
            name='Other AI WS', slug='other-ai-ws', owner=other_user,
        )

        patches = self._patch_pipeline()
        with patches['ensure_design_vision'] as ensure_mock, \
                patches['build_prompt'], patches['call_llm'], \
                patches['validate_and_truncate']:
            resp = api_client.post(
                f'/api/listings/{listing.id}/ai-improve/',
                {},
                format='json',
                HTTP_X_WORKSPACE_ID=str(other_ws.id),
            )

        assert resp.status_code == 404
        # Isolation guard must fire before any pipeline work.
        ensure_mock.assert_not_called()

    def test_returns_429_after_10_calls_per_minute(
        self, api_client, workspace, listing, membership,
    ):
        """M3/M5: per-user throttle (`ai_improve` scope = 10/min).

        Enforces the AC-72 rate cap. 10 consecutive POSTs succeed (200);
        the 11th within the same minute window is rejected with 429
        without invoking the pipeline. We override the throttle rate
        locally (``AIImproveThrottle.THROTTLE_RATES``) because the global
        ``disable_throttling`` fixture sets ``ai_improve: 10000/day`` for
        every other test -- a production-like ``10/min`` rate only applies
        here, and is scoped via ``patch.object``.
        """
        from django.core.cache import cache as django_cache

        from publish_app.api.throttles import AIImproveThrottle

        patches = self._patch_pipeline()
        # Local ``10/min`` override (shadows the test fixture for this test
        # only). ``patch.object`` restores the original dict on exit, so
        # subsequent tests still see the high fixture rate.
        with patch.object(
            AIImproveThrottle,
            'THROTTLE_RATES',
            {'ai_improve': '10/min'},
        ), patches['ensure_design_vision'] as ensure_mock, \
                patches['build_prompt'], patches['call_llm'] as llm_mock, \
                patches['validate_and_truncate']:
            # Fresh throttle bucket for this user on this scope.
            django_cache.clear()

            # First 10 calls inside the window succeed.
            for i in range(10):
                resp = api_client.post(
                    f'/api/listings/{listing.id}/ai-improve/',
                    {},
                    format='json',
                    **ws_headers(workspace),
                )
                assert resp.status_code == 200, (
                    f'call #{i + 1} unexpectedly blocked: {resp.status_code}'
                )

            # 11th call in the same minute -> 429. Pipeline must NOT run.
            pipeline_calls_before = (
                ensure_mock.call_count,
                llm_mock.call_count,
            )
            resp = api_client.post(
                f'/api/listings/{listing.id}/ai-improve/',
                {},
                format='json',
                **ws_headers(workspace),
            )

            assert resp.status_code == 429
            # DRF includes a Retry-After hint on throttled responses.
            assert 'Retry-After' in resp.headers or 'retry-after' in {
                k.lower() for k in resp.headers
            }
            # Throttle must short-circuit BEFORE the pipeline runs.
            assert (
                ensure_mock.call_count,
                llm_mock.call_count,
            ) == pipeline_calls_before


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
                        'product_type': 't_shirt',
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
        assert resp.data['products_config'][0]['product_type'] == 't_shirt'

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

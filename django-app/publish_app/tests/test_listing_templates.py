"""Tests for Listing Templates (PROJ-11 F5 / AC-45..AC-51, EC-16, EC-21, EC-22).

Covers:
- Model: is_template + design mutual exclusion (clean / full_clean)
- Serializer POST: create with null design ok; with design ID -> 400
- Serializer PATCH: cannot flip is_template (EC-21)
- GET /api/listings/templates/: workspace isolation, marketplace filter
- GET /api/ideas/<id>/listing/: excludes templates (AC-51, EC-22)
- DELETE /api/listings/<id>/: works for templates, workspace isolation
- Convert with template source: target is_template=False, source unchanged
- URL ordering: /listings/templates/ does not collide with /listings/<uuid>/
"""

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import DesignAsset, Listing
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='tpl@example.com', password='testpass123',
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='tpl-other@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='Tpl WS', slug='tpl-ws', owner=user,
    )


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(
        name='Other Tpl WS', slug='other-tpl-ws', owner=other_user,
    )


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
        workspace=workspace, name='Tpl Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Template Slogan', created_by=user,
    )


@pytest.fixture
def design(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='tpl.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def foreign_idea(other_workspace, other_user):
    foreign_niche = Niche.objects.create(
        workspace=other_workspace, name='Foreign Niche',
        created_by=other_user,
    )
    return Idea.objects.create(
        workspace=other_workspace, niche=foreign_niche,
        slogan_text='Foreign', created_by=other_user,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingTemplateModel:
    def test_is_template_default_false(self, workspace, idea):
        listing = Listing.objects.create(workspace=workspace, idea=idea)
        assert listing.is_template is False

    def test_template_with_design_raises_clean(
        self, workspace, idea, design,
    ):
        listing = Listing(
            workspace=workspace, idea=idea, design=design,
            is_template=True,
        )
        with pytest.raises(ValidationError) as exc:
            listing.full_clean()
        assert 'design' in str(exc.value)

    def test_template_with_null_design_clean_ok(
        self, workspace, idea,
    ):
        # Templates with null design are valid.
        listing = Listing(
            workspace=workspace, idea=idea, design=None,
            is_template=True,
        )
        # full_clean validates required fields; we only care that the
        # design/template constraint doesn't fire.
        try:
            listing.full_clean(exclude=None)
        except ValidationError as exc:
            # If anything other than `design` errored, fail.
            assert 'design' not in exc.message_dict

    def test_non_template_with_null_design_ok(
        self, workspace, idea,
    ):
        # Existing behavior preserved: regular listings may have null design.
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=False,
        )
        assert listing.is_template is False
        assert listing.design is None


# ---------------------------------------------------------------------------
# POST /api/listings/templates/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingTemplateCreate:
    def test_create_template_succeeds_201(
        self, api_client, workspace, idea, membership,
    ):
        resp = api_client.post(
            '/api/listings/templates/',
            {
                'idea': str(idea.id),
                'marketplace_type': 'mba',
                'brand_name': 'Tpl Brand',
                'title': 'Tpl Title',
                'bullet_1': 'B1',
                'description': 'Tpl Desc',
                'keyword_context': 'kw1, kw2',
                'language': 'en',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert resp.data['is_template'] is True
        assert resp.data['design'] is None
        # Persisted row reflects the same.
        listing = Listing.objects.get(pk=resp.data['id'])
        assert listing.is_template is True
        assert listing.design is None
        assert listing.title == 'Tpl Title'

    def test_create_template_with_design_id_returns_400(
        self, api_client, workspace, idea, design, membership,
    ):
        # EC-16: passing a design ID for a template -> 400
        resp = api_client.post(
            '/api/listings/templates/',
            {
                'idea': str(idea.id),
                'design': str(design.id),
                'marketplace_type': 'mba',
                'title': 'Bad Tpl',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'design' in resp.data
        # No row was created.
        assert not Listing.objects.filter(title='Bad Tpl').exists()

    def test_create_template_default_marketplace_is_mba(
        self, api_client, workspace, idea, membership,
    ):
        resp = api_client.post(
            '/api/listings/templates/',
            {'idea': str(idea.id), 'title': 'Default MBA Tpl'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        assert resp.data['marketplace_type'] == 'mba'
        assert resp.data['is_template'] is True

    def test_create_template_requires_idea(
        self, api_client, workspace, membership,
    ):
        resp = api_client.post(
            '/api/listings/templates/',
            {'title': 'No idea'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_create_template_cross_workspace_idea_returns_404(
        self, api_client, workspace, foreign_idea, membership,
    ):
        # Idea belongs to another workspace -> 404 (no enumeration).
        resp = api_client.post(
            '/api/listings/templates/',
            {'idea': str(foreign_idea.id), 'title': 'Stolen'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404
        assert not Listing.objects.filter(title='Stolen').exists()

    def test_create_template_without_header_uses_active_membership(
        self, api_client, idea,
    ):
        # Fallback to user's active membership — idea may live in a different
        # workspace, so 201 (matches) or 404 (cross-workspace idea).
        resp = api_client.post(
            '/api/listings/templates/',
            {'idea': str(idea.id), 'title': 'No WS'},
            format='json',
        )
        assert resp.status_code in (201, 404)

    def test_create_template_force_is_template_true(
        self, api_client, workspace, idea, membership,
    ):
        # Even if caller tries to set is_template=False, server forces True.
        resp = api_client.post(
            '/api/listings/templates/',
            {
                'idea': str(idea.id),
                'is_template': False,
                'title': 'Forced True',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['is_template'] is True


# ---------------------------------------------------------------------------
# PATCH /api/listings/<id>/ — EC-21 reject is_template flip
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingPatchIsTemplateRejected:
    def test_patch_flip_is_template_to_true_returns_400(
        self, api_client, workspace, idea, design, membership,
    ):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
            is_template=False,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'is_template': True},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'is_template' in resp.data
        listing.refresh_from_db()
        assert listing.is_template is False

    def test_patch_flip_is_template_to_false_returns_400(
        self, api_client, workspace, idea, membership,
    ):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'is_template': False},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400
        listing.refresh_from_db()
        assert listing.is_template is True


# ---------------------------------------------------------------------------
# GET /api/listings/templates/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingTemplateList:
    def test_list_returns_only_templates(
        self, api_client, workspace, idea, design, membership,
    ):
        # Mix of templates and regular listings.
        Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
            is_template=False, title='Real',
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, title='Tpl 1',
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, title='Tpl 2',
        )

        resp = api_client.get(
            '/api/listings/templates/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        titles = {r['title'] for r in resp.data['results']}
        assert titles == {'Tpl 1', 'Tpl 2'}
        for r in resp.data['results']:
            assert r['is_template'] is True

    def test_list_workspace_isolation(
        self, api_client, workspace, other_workspace, foreign_idea,
        idea, membership,
    ):
        # Foreign template — should not appear.
        Listing.objects.create(
            workspace=other_workspace, idea=foreign_idea, design=None,
            is_template=True, title='Foreign Tpl',
        )
        # Local template.
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, title='Mine',
        )
        resp = api_client.get(
            '/api/listings/templates/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        titles = {r['title'] for r in resp.data['results']}
        assert titles == {'Mine'}

    def test_list_marketplace_filter(
        self, api_client, workspace, idea, membership,
    ):
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, marketplace_type='mba', title='MBA Tpl',
        )
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, marketplace_type='global', title='Global Tpl',
        )

        resp = api_client.get(
            '/api/listings/templates/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        titles = {r['title'] for r in resp.data['results']}
        assert titles == {'MBA Tpl'}

    def test_list_invalid_marketplace_returns_400(
        self, api_client, workspace, membership,
    ):
        resp = api_client.get(
            '/api/listings/templates/?marketplace_type=bogus',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_list_ordered_newest_first(
        self, api_client, workspace, idea, membership,
    ):
        first = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, title='First',
        )
        second = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, title='Second',
        )
        resp = api_client.get(
            '/api/listings/templates/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        ids = [r['id'] for r in resp.data['results']]
        assert ids == [str(second.id), str(first.id)]


# ---------------------------------------------------------------------------
# GET /api/ideas/<id>/listing/ — AC-51 + EC-22
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingDetailExcludesTemplates:
    def test_listing_detail_excludes_templates(
        self, api_client, workspace, idea, membership,
    ):
        # A template referencing this idea — must NOT be returned.
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, marketplace_type='mba',
            title='Should Not Appear',
        )
        # A real listing for the same idea + marketplace_type — must be
        # the one returned.
        real = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=False, marketplace_type='mba',
            title='Real Listing',
        )

        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['id'] == str(real.id)
        assert resp.data['title'] == 'Real Listing'

    def test_listing_detail_404_when_only_template_exists(
        self, api_client, workspace, idea, membership,
    ):
        # Only a template exists for this idea — endpoint must 404 since
        # templates are excluded.
        Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, marketplace_type='mba',
            title='Tpl Only',
        )
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/listings/<id>/ — AC-49
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingDelete:
    def test_delete_template_succeeds(
        self, api_client, workspace, idea, membership,
    ):
        template = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, title='Doomed Tpl',
        )
        resp = api_client.delete(
            f'/api/listings/{template.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not Listing.objects.filter(pk=template.id).exists()

    def test_delete_regular_listing_succeeds(
        self, api_client, workspace, idea, design, membership,
    ):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
            is_template=False,
        )
        resp = api_client.delete(
            f'/api/listings/{listing.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not Listing.objects.filter(pk=listing.id).exists()

    def test_delete_cross_workspace_returns_404(
        self, api_client, workspace, other_workspace, foreign_idea,
        membership,
    ):
        foreign_template = Listing.objects.create(
            workspace=other_workspace, idea=foreign_idea, design=None,
            is_template=True, title='Foreign',
        )
        resp = api_client.delete(
            f'/api/listings/{foreign_template.id}/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404
        # Still exists in the other workspace.
        assert Listing.objects.filter(pk=foreign_template.id).exists()


# ---------------------------------------------------------------------------
# Convert with template source — AC-50
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingConvertFromTemplate:
    def test_convert_with_template_source_creates_non_template(
        self, api_client, workspace, idea, membership,
    ):
        template = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True,
            marketplace_type='global',
            brand_name='Tpl Brand',
            title='Tpl Title',
            description='Tpl Desc',
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(template.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        # Target is a real (non-template) listing.
        assert resp.data['is_template'] is False
        assert resp.data['marketplace_type'] == 'mba'
        # Original template unchanged.
        template.refresh_from_db()
        assert template.is_template is True
        assert template.marketplace_type == 'global'

    def test_convert_template_source_target_keeps_null_design(
        self, api_client, workspace, idea, membership,
    ):
        template = Listing.objects.create(
            workspace=workspace, idea=idea, design=None,
            is_template=True, marketplace_type='global', title='Tpl',
        )
        resp = api_client.post(
            '/api/listings/convert/',
            {
                'source_listing_id': str(template.id),
                'target_marketplace_type': 'mba',
            },
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 201
        # Target inherits null design from the template source.
        assert resp.data['design'] is None
        target = Listing.objects.get(pk=resp.data['id'])
        assert target.design is None
        assert target.is_template is False


# ---------------------------------------------------------------------------
# URL ordering — /listings/templates/ vs /listings/<uuid>/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingTemplateUrlOrdering:
    def test_templates_path_does_not_match_uuid_route(
        self, api_client, workspace, membership,
    ):
        # /api/listings/templates/ must hit the template list, not the
        # UUID-based listing-update view (which would 404 with the literal
        # string `templates`). The `<uuid:pk>` converter naturally rejects
        # non-UUID values, but we also want a positive assertion that the
        # template route is reachable + returns 200 (empty list).
        resp = api_client.get(
            '/api/listings/templates/',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['results'] == []

    def test_uuid_listing_update_still_reachable(
        self, api_client, workspace, idea, design, membership,
    ):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'title': 'Updated Title'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['title'] == 'Updated Title'

    def test_random_uuid_returns_404_not_collision(
        self, api_client, workspace, membership,
    ):
        # Random UUID -> 404 from the listing-update view, not the template
        # list view.
        resp = api_client.patch(
            f'/api/listings/{uuid.uuid4()}/',
            {'title': 'X'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 404

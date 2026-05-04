"""PROJ-11 Phase I4 — serializer-level tests for Listing shrink + rename.

Covers AC-1 (2026-04-22):

- ``ListingSerializer``/``ListingUpdateSerializer``/``ListingTemplateCreateSerializer``
  expose ``bullet_1``, ``bullet_2`` and ``keyword_context`` -- NOT the legacy
  ``bullet_3``/``bullet_4``/``bullet_5`` columns or ``backend_keywords`` field.
- ``keyword_context`` honors ``max_length=500``, is not required, and allows
  blank strings (matches model field + AC-1 hint semantics).
- Unknown legacy keys passed to the update serializer are silently dropped
  by DRF (they must not round-trip back onto the model).
"""

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.api.serializers import (
    ListingSerializer,
    ListingTemplateCreateSerializer,
    ListingUpdateSerializer,
)
from publish_app.models import Listing
from workspace_app.models import Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def user(db):
    return User.objects.create_user(email='ser@example.com', password='x')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='SerWS', slug='ser-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='SerNiche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Ser slogan', created_by=user,
    )


@pytest.fixture
def listing(workspace, idea):
    return Listing.objects.create(
        workspace=workspace, idea=idea,
        brand_name='Brand', title='Title',
        bullet_1='B1', bullet_2='B2',
        description='Desc', keyword_context='kw, ctx',
    )


# ---------------------------------------------------------------------------
# ListingSerializer (read) — field shape
# ---------------------------------------------------------------------------

class TestListingSerializerFields:
    def test_serializer_exposes_bullet_1_and_bullet_2_only(self, listing):
        data = ListingSerializer(listing).data
        assert 'bullet_1' in data
        assert 'bullet_2' in data

    def test_serializer_drops_legacy_bullet_3_4_5(self, listing):
        """AC-1: bullets 3-5 no longer live on the model or serializer."""
        data = ListingSerializer(listing).data
        assert 'bullet_3' not in data
        assert 'bullet_4' not in data
        assert 'bullet_5' not in data

    def test_serializer_renames_backend_keywords_to_keyword_context(
        self, listing,
    ):
        data = ListingSerializer(listing).data
        assert 'keyword_context' in data
        assert data['keyword_context'] == 'kw, ctx'
        assert 'backend_keywords' not in data


# ---------------------------------------------------------------------------
# ListingUpdateSerializer — PATCH shape + keyword_context rules
# ---------------------------------------------------------------------------

class TestListingUpdateSerializerFields:
    def test_update_serializer_fields_list_is_shrunk(self):
        """Fields tuple must not contain bullet_3/4/5 or backend_keywords."""
        fields = set(ListingUpdateSerializer.Meta.fields)
        assert 'bullet_1' in fields
        assert 'bullet_2' in fields
        assert 'keyword_context' in fields
        assert 'bullet_3' not in fields
        assert 'bullet_4' not in fields
        assert 'bullet_5' not in fields
        assert 'backend_keywords' not in fields

    def test_patch_accepts_bullet_1_and_bullet_2(self, listing):
        ser = ListingUpdateSerializer(
            listing,
            data={'bullet_1': 'new 1', 'bullet_2': 'new 2'},
            partial=True,
        )
        assert ser.is_valid(), ser.errors
        assert ser.validated_data['bullet_1'] == 'new 1'
        assert ser.validated_data['bullet_2'] == 'new 2'

    def test_patch_silently_drops_legacy_bullet_3_4_5_keys(self, listing):
        """DRF ignores unknown keys on ModelSerializer; legacy bullets 3-5
        must not appear in validated_data (they cannot persist anywhere).
        """
        ser = ListingUpdateSerializer(
            listing,
            data={
                'bullet_1': 'ok',
                'bullet_3': 'ghost',
                'bullet_4': 'ghost',
                'bullet_5': 'ghost',
                'backend_keywords': 'ghost-kw',
            },
            partial=True,
        )
        assert ser.is_valid(), ser.errors
        validated = ser.validated_data
        assert 'bullet_3' not in validated
        assert 'bullet_4' not in validated
        assert 'bullet_5' not in validated
        assert 'backend_keywords' not in validated
        # The legitimate update still went through.
        assert validated['bullet_1'] == 'ok'

    def test_keyword_context_not_required(self, listing):
        """PATCH body may omit keyword_context entirely."""
        ser = ListingUpdateSerializer(
            listing, data={'title': 'New Title'}, partial=True,
        )
        assert ser.is_valid(), ser.errors
        assert 'keyword_context' not in ser.validated_data

    def test_keyword_context_allows_blank(self, listing):
        ser = ListingUpdateSerializer(
            listing, data={'keyword_context': ''}, partial=True,
        )
        assert ser.is_valid(), ser.errors
        assert ser.validated_data['keyword_context'] == ''

    def test_keyword_context_enforces_max_length_500(self, listing):
        ser = ListingUpdateSerializer(
            listing, data={'keyword_context': 'a' * 501}, partial=True,
        )
        assert not ser.is_valid()
        assert 'keyword_context' in ser.errors

    def test_keyword_context_at_exact_limit_accepted(self, listing):
        ser = ListingUpdateSerializer(
            listing, data={'keyword_context': 'a' * 500}, partial=True,
        )
        assert ser.is_valid(), ser.errors


# ---------------------------------------------------------------------------
# ListingTemplateCreateSerializer — create shape
# ---------------------------------------------------------------------------

class TestListingTemplateCreateSerializerFields:
    def test_template_create_serializer_fields_list_is_shrunk(self):
        fields = set(ListingTemplateCreateSerializer.Meta.fields)
        assert 'bullet_1' in fields
        assert 'bullet_2' in fields
        assert 'keyword_context' in fields
        assert 'bullet_3' not in fields
        assert 'bullet_4' not in fields
        assert 'bullet_5' not in fields
        assert 'backend_keywords' not in fields

    def test_template_create_accepts_keyword_context(self, idea):
        ser = ListingTemplateCreateSerializer(
            data={
                'idea': str(idea.id),
                'marketplace_type': 'mba',
                'brand_name': 'Tpl',
                'title': 'Tpl Title',
                'bullet_1': 'B1',
                'bullet_2': 'B2',
                'description': 'Desc',
                'keyword_context': 'hint, words',
                'language': 'en',
            },
        )
        assert ser.is_valid(), ser.errors
        assert ser.validated_data['keyword_context'] == 'hint, words'

    def test_template_create_omits_keyword_context(self, idea):
        """keyword_context is optional on template create (AC-48)."""
        ser = ListingTemplateCreateSerializer(
            data={
                'idea': str(idea.id),
                'marketplace_type': 'mba',
                'title': 'Tpl Title',
            },
        )
        assert ser.is_valid(), ser.errors

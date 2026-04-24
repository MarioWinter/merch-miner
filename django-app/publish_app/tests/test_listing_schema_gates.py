"""Tests for per-field marketplace gates on Listing PATCH (PROJ-11 Phase R2).

Covers AC-82 / AC-110 / AC-123 / AC-124:
- ``keywords`` allowed on global + displate, rejected on mba (+ comma/semicolon reject)
- ``type_flags`` allowed on global + displate, rejected on mba
- ``color_mode`` allowed only on global
- ``background_color_hex`` allowed only on displate (+ hex format check)
- ``category`` allowed on mba + global, rejected on displate
- Serializer output hides fields for non-allowed marketplaces (AC-87).
"""

import pytest
from django.contrib.auth import get_user_model
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
        email='gates@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(
        name='Gates WS', slug='gates-ws', owner=user,
    )


@pytest.fixture
def membership(workspace, user):
    return Membership.objects.create(
        workspace=workspace, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def api_client(user, membership):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Gates Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Gates Slogan', created_by=user,
    )


@pytest.fixture
def design(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='gates.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _make_listing(workspace, idea, marketplace_type, design=None, **extra):
    return Listing.objects.create(
        workspace=workspace, idea=idea, design=design,
        marketplace_type=marketplace_type, **extra,
    )


# ---------------------------------------------------------------------------
# keywords gate (AC-82 / AC-124)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestKeywordsGate:
    def test_mba_rejects_keywords(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.MBA, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keywords': {'en': ['dog', 'cat']}},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'keywords' in resp.data
        listing.refresh_from_db()
        assert listing.keywords == {}

    def test_global_accepts_keywords(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keywords': {'en': ['dog', 'cat'], 'de': ['hund']}},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['keywords'] == {'en': ['dog', 'cat'], 'de': ['hund']}
        listing.refresh_from_db()
        assert listing.keywords == {'en': ['dog', 'cat'], 'de': ['hund']}

    def test_displate_accepts_keywords(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keywords': {'en': ['poster']}},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['keywords'] == {'en': ['poster']}

    def test_keywords_comma_rejected(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keywords': {'en': ['dog,cat']}},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'keywords' in resp.data
        # AC-110 message
        assert any(
            'Keyword cannot contain' in str(e)
            for e in resp.data['keywords']
        )

    def test_keywords_semicolon_rejected(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keywords': {'en': ['dog;cat']}},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data

    def test_keywords_unknown_language_rejected(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'keywords': {'zz': ['foo']}},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data


# ---------------------------------------------------------------------------
# type_flags gate (AC-82 / AC-124)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTypeFlagsGate:
    def test_mba_rejects_type_flags(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.MBA, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'type_flags': ['men']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'type_flags' in resp.data

    def test_global_accepts_type_flags(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'type_flags': ['men', 'women']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['type_flags'] == ['men', 'women']

    def test_displate_accepts_type_flags(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'type_flags': ['youth']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['type_flags'] == ['youth']

    def test_unknown_type_flag_rejected(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'type_flags': ['men', 'alien']},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data


# ---------------------------------------------------------------------------
# color_mode gate (AC-82 -- Global-only)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestColorModeGate:
    def test_global_accepts_color_mode(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'color_mode': 'black'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['color_mode'] == 'black'

    def test_mba_rejects_color_mode(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.MBA, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'color_mode': 'white'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'color_mode' in resp.data

    def test_displate_rejects_color_mode(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'color_mode': 'colorful'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'color_mode' in resp.data


# ---------------------------------------------------------------------------
# background_color_hex gate (AC-82 -- Displate-only) + hex format (AC-123)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestBackgroundColorHexGate:
    def test_displate_accepts_background_hex(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'background_color_hex': '#AABBCC'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['background_color_hex'] == '#AABBCC'

    def test_global_rejects_background_hex(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'background_color_hex': '#AABBCC'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'background_color_hex' in resp.data

    def test_mba_rejects_background_hex(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.MBA, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'background_color_hex': '#112233'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data

    def test_hex_format_rejected(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'background_color_hex': 'AABBCC'},  # missing `#`
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'background_color_hex' in resp.data

    def test_hex_format_short_rejected(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'background_color_hex': '#ABC'},  # 3 chars not allowed
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data


# ---------------------------------------------------------------------------
# category gate (AC-82 -- rejected on Displate)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCategoryGate:
    def test_mba_accepts_category(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.MBA, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'category': 'Funny Shirts'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['category'] == 'Funny Shirts'

    def test_global_accepts_category(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'category': 'Apparel'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['category'] == 'Apparel'

    def test_displate_rejects_category(
        self, api_client, workspace, idea, design,
    ):
        listing = _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
        )
        resp = api_client.patch(
            f'/api/listings/{listing.id}/',
            {'category': 'Posters'},
            format='json',
            **ws_headers(workspace),
        )
        assert resp.status_code == 400, resp.data
        assert 'category' in resp.data


# ---------------------------------------------------------------------------
# Serializer output hides non-allowed fields (AC-87 / AC-82)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestListingSerializerFieldHiding:
    def test_mba_output_hides_global_displate_fields(
        self, api_client, workspace, idea, design,
    ):
        _make_listing(
            workspace, idea, Listing.MarketplaceType.MBA, design=design,
            title='MBA Title', category='Funny',
        )
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=mba',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        # MBA allowed fields
        assert 'category' in resp.data
        # MBA hidden fields
        assert 'keywords' not in resp.data
        assert 'type_flags' not in resp.data
        assert 'color_mode' not in resp.data
        assert 'background_color_hex' not in resp.data

    def test_global_output_hides_displate_fields(
        self, api_client, workspace, idea, design,
    ):
        _make_listing(
            workspace, idea, Listing.MarketplaceType.GLOBAL, design=design,
            title='Global Title',
        )
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=global',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        # Global allowed fields
        assert 'keywords' in resp.data
        assert 'type_flags' in resp.data
        assert 'color_mode' in resp.data
        assert 'category' in resp.data
        # Global hidden fields
        assert 'background_color_hex' not in resp.data

    def test_displate_output_hides_global_mba_fields(
        self, api_client, workspace, idea, design,
    ):
        _make_listing(
            workspace, idea, Listing.MarketplaceType.DISPLATE, design=design,
            title='Displate Title',
        )
        resp = api_client.get(
            f'/api/ideas/{idea.id}/listing/?marketplace_type=displate',
            **ws_headers(workspace),
        )
        assert resp.status_code == 200, resp.data
        # Displate allowed fields
        assert 'keywords' in resp.data
        assert 'type_flags' in resp.data
        assert 'background_color_hex' in resp.data
        # Displate hidden fields
        assert 'color_mode' not in resp.data
        assert 'category' not in resp.data

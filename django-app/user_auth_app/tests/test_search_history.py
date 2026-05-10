"""Tests for /api/users/me/search-history/ — per-user persisted research history."""

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User, UserSearchHistory

pytestmark = pytest.mark.django_db


def _make_user(email):
    return User.objects.create_user(
        email=email, password='TestPass123!', username=email, is_active=True,
    )


def _auth_client(user):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies['access_token'] = token
    return client


URL = '/api/users/me/search-history/'
URL_CLEAR = '/api/users/me/search-history/clear/'


# ---------------------------------------------------------------------------
# Auth + ownership scoping
# ---------------------------------------------------------------------------

class TestSearchHistoryAuth:
    def test_unauthenticated_list_returns_401(self):
        resp = APIClient().get(URL)
        assert resp.status_code in (401, 403)

    def test_unauthenticated_post_returns_401(self):
        resp = APIClient().post(URL, {'context': 'amazon_research', 'keyword': 'x'}, format='json')
        assert resp.status_code in (401, 403)

    def test_user_only_sees_own_entries(self):
        a = _make_user('a@test.com')
        b = _make_user('b@test.com')
        UserSearchHistory.objects.create(user=a, context='amazon_research', keyword='alpha')
        UserSearchHistory.objects.create(user=b, context='amazon_research', keyword='beta')

        resp = _auth_client(a).get(URL + '?context=amazon_research')
        assert resp.status_code == 200
        keywords = [r['keyword'] for r in resp.data]
        assert keywords == ['alpha']

    def test_user_cannot_delete_other_users_entry(self):
        a = _make_user('a@test.com')
        b = _make_user('b@test.com')
        b_entry = UserSearchHistory.objects.create(
            user=b, context='amazon_research', keyword='other',
        )

        resp = _auth_client(a).delete(f'{URL}{b_entry.id}/')
        assert resp.status_code == 404
        assert UserSearchHistory.objects.filter(id=b_entry.id).exists()


# ---------------------------------------------------------------------------
# List + filter by context
# ---------------------------------------------------------------------------

class TestSearchHistoryList:
    def test_returns_newest_first(self):
        u = _make_user('u@test.com')
        UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='old')
        UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='new')

        resp = _auth_client(u).get(URL + '?context=amazon_research')
        keywords = [r['keyword'] for r in resp.data]
        assert keywords == ['new', 'old']

    def test_context_filter_isolates_surfaces(self):
        u = _make_user('u@test.com')
        UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='ar1')
        UserSearchHistory.objects.create(user=u, context='keyword_drilling', keyword='kd1')

        resp_ar = _auth_client(u).get(URL + '?context=amazon_research')
        assert [r['keyword'] for r in resp_ar.data] == ['ar1']
        resp_kd = _auth_client(u).get(URL + '?context=keyword_drilling')
        assert [r['keyword'] for r in resp_kd.data] == ['kd1']

    def test_no_context_filter_returns_all_users_entries(self):
        u = _make_user('u@test.com')
        UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='ar1')
        UserSearchHistory.objects.create(user=u, context='keyword_drilling', keyword='kd1')

        resp = _auth_client(u).get(URL)
        assert resp.status_code == 200
        assert len(resp.data) == 2


# ---------------------------------------------------------------------------
# Create + upsert + auto-prune
# ---------------------------------------------------------------------------

class TestSearchHistoryCreate:
    def test_create_returns_201(self):
        u = _make_user('u@test.com')
        resp = _auth_client(u).post(
            URL,
            {'context': 'amazon_research', 'keyword': 'test'},
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['keyword'] == 'test'
        assert UserSearchHistory.objects.filter(user=u).count() == 1

    def test_create_strips_whitespace_in_keyword(self):
        u = _make_user('u@test.com')
        resp = _auth_client(u).post(
            URL,
            {'context': 'amazon_research', 'keyword': '  spaced  '},
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['keyword'] == 'spaced'

    def test_create_rejects_empty_keyword(self):
        u = _make_user('u@test.com')
        resp = _auth_client(u).post(
            URL,
            {'context': 'amazon_research', 'keyword': '   '},
            format='json',
        )
        assert resp.status_code == 400

    def test_create_upsert_bumps_existing_to_top(self):
        u = _make_user('u@test.com')
        # Make first entry then a second
        c = _auth_client(u)
        c.post(URL, {'context': 'amazon_research', 'keyword': 'first'}, format='json')
        c.post(URL, {'context': 'amazon_research', 'keyword': 'second'}, format='json')
        # Re-search 'first' — should bump to top, not create duplicate
        resp = c.post(URL, {'context': 'amazon_research', 'keyword': 'first'}, format='json')
        assert resp.status_code == 200  # 200 not 201 since existing
        listing = c.get(URL + '?context=amazon_research').data
        assert [r['keyword'] for r in listing] == ['first', 'second']
        assert UserSearchHistory.objects.filter(user=u).count() == 2

    def test_create_marketplace_distinguishes_entries(self):
        u = _make_user('u@test.com')
        c = _auth_client(u)
        c.post(
            URL,
            {'context': 'amazon_research', 'keyword': 'shirt', 'marketplace': 'amazon_com'},
            format='json',
        )
        c.post(
            URL,
            {'context': 'amazon_research', 'keyword': 'shirt', 'marketplace': 'amazon_de'},
            format='json',
        )
        # Different marketplaces → 2 distinct entries
        assert UserSearchHistory.objects.filter(user=u).count() == 2

    def test_create_auto_prunes_oldest_beyond_cap_of_10(self):
        u = _make_user('u@test.com')
        c = _auth_client(u)
        # Create 12 entries — only newest 10 should survive
        for i in range(12):
            c.post(
                URL,
                {'context': 'amazon_research', 'keyword': f'kw-{i:02d}'},
                format='json',
            )
        survivors = list(
            UserSearchHistory.objects.filter(
                user=u, context='amazon_research',
            ).order_by('-created_at').values_list('keyword', flat=True),
        )
        assert len(survivors) == 10
        # kw-00, kw-01 should be pruned; kw-11 (newest) should be in there
        assert 'kw-00' not in survivors
        assert 'kw-01' not in survivors
        assert 'kw-11' in survivors

    def test_create_extra_metadata_persisted(self):
        u = _make_user('u@test.com')
        resp = _auth_client(u).post(
            URL,
            {
                'context': 'keyword_drilling',
                'keyword': 'mug',
                'extra_metadata': {'niche_id': 'abc-123', 'source': 'js_enrich'},
            },
            format='json',
        )
        assert resp.status_code == 201
        entry = UserSearchHistory.objects.get(id=resp.data['id'])
        assert entry.extra_metadata == {'niche_id': 'abc-123', 'source': 'js_enrich'}


# ---------------------------------------------------------------------------
# Delete + clear
# ---------------------------------------------------------------------------

class TestSearchHistoryDelete:
    def test_delete_one_entry(self):
        u = _make_user('u@test.com')
        e = UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='gone')
        resp = _auth_client(u).delete(f'{URL}{e.id}/')
        assert resp.status_code == 204
        assert not UserSearchHistory.objects.filter(id=e.id).exists()

    def test_delete_unknown_returns_404(self):
        u = _make_user('u@test.com')
        resp = _auth_client(u).delete(f'{URL}00000000-0000-0000-0000-000000000000/')
        assert resp.status_code == 404

    def test_clear_context_wipes_only_that_context(self):
        u = _make_user('u@test.com')
        UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='ar')
        UserSearchHistory.objects.create(user=u, context='keyword_drilling', keyword='kd')

        resp = _auth_client(u).delete(URL_CLEAR + '?context=amazon_research')
        assert resp.status_code == 200
        assert resp.data['deleted'] == 1
        assert UserSearchHistory.objects.filter(user=u).count() == 1
        assert UserSearchHistory.objects.filter(user=u, context='keyword_drilling').exists()

    def test_clear_without_context_wipes_all(self):
        u = _make_user('u@test.com')
        UserSearchHistory.objects.create(user=u, context='amazon_research', keyword='ar')
        UserSearchHistory.objects.create(user=u, context='keyword_drilling', keyword='kd')

        resp = _auth_client(u).delete(URL_CLEAR)
        assert resp.status_code == 200
        assert resp.data['deleted'] == 2
        assert UserSearchHistory.objects.filter(user=u).count() == 0

    def test_clear_does_not_touch_other_users(self):
        a = _make_user('a@test.com')
        b = _make_user('b@test.com')
        UserSearchHistory.objects.create(user=a, context='amazon_research', keyword='a-only')
        UserSearchHistory.objects.create(user=b, context='amazon_research', keyword='b-only')

        _auth_client(a).delete(URL_CLEAR)
        assert UserSearchHistory.objects.filter(user=b).count() == 1

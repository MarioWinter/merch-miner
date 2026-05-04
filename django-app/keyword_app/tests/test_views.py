"""Tests for keyword_app API views."""

from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from keyword_app.models import (
    KeywordJSCache,
    NicheKeyword,
    NicheKeywordGroup,
)


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(
        email='kwtest@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace, Membership
    ws = Workspace.objects.create(name='KW WS', slug='kw-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )
    return ws


@pytest.fixture
def niche(db, workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=workspace, name='Camping Dad', created_by=user,
    )


@pytest.fixture
def api_client(user, workspace):
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_WORKSPACE_ID'] = str(workspace.id)
    return client


@pytest.fixture
def other_workspace(db):
    from django.contrib.auth import get_user_model
    from workspace_app.models import Workspace, Membership
    other_user = get_user_model().objects.create_user(
        email='other@test.com', password='testpass123',
    )
    ws = Workspace.objects.create(name='Other WS', slug='other-ws', owner=other_user)
    Membership.objects.create(
        workspace=ws, user=other_user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )
    return ws


# ==============================================================
# Niche Keywords CRUD
# ==============================================================

class TestNicheKeywordListCreate:
    def test_list_empty(self, api_client, niche):
        resp = api_client.get(f'/api/niches/{niche.id}/keywords/')
        assert resp.status_code == 200
        assert resp.data['count'] == 0

    def test_create_keyword(self, api_client, niche):
        resp = api_client.post(
            f'/api/niches/{niche.id}/keywords/',
            {'keyword': 'camping humor', 'source': 'manual'},
        )
        assert resp.status_code == 201
        assert resp.data['keyword'] == 'camping humor'
        assert resp.data['source'] == 'manual'

    def test_create_duplicate_409(self, api_client, niche, user):
        NicheKeyword.objects.create(
            niche=niche, keyword='camping', source='manual', created_by=user,
        )
        resp = api_client.post(
            f'/api/niches/{niche.id}/keywords/',
            {'keyword': 'camping', 'source': 'research'},
        )
        assert resp.status_code == 409

    def test_list_with_filter(self, api_client, niche, user):
        NicheKeyword.objects.create(
            niche=niche, keyword='test1', source='manual', created_by=user,
        )
        NicheKeyword.objects.create(
            niche=niche, keyword='test2', source='research', created_by=user,
        )
        resp = api_client.get(f'/api/niches/{niche.id}/keywords/?source=manual')
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_workspace_isolation(self, api_client, other_workspace):
        """Can't access niches from other workspace."""
        from niche_app.models import Niche
        from django.contrib.auth import get_user_model
        other_user = get_user_model().objects.get(email='other@test.com')
        other_niche = Niche.objects.create(
            workspace=other_workspace, name='Other Niche', created_by=other_user,
        )
        resp = api_client.get(f'/api/niches/{other_niche.id}/keywords/')
        assert resp.status_code == 404


class TestNicheKeywordBulkAdd:
    def test_bulk_add(self, api_client, niche):
        resp = api_client.post(
            f'/api/niches/{niche.id}/keywords/bulk-add/',
            {
                'keywords': [
                    {'keyword': 'kw1', 'source': 'manual'},
                    {'keyword': 'kw2', 'source': 'research'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['added'] == 2
        assert NicheKeyword.objects.filter(niche=niche).count() == 2

    def test_bulk_add_skips_duplicates(self, api_client, niche, user):
        NicheKeyword.objects.create(
            niche=niche, keyword='existing', source='manual', created_by=user,
        )
        resp = api_client.post(
            f'/api/niches/{niche.id}/keywords/bulk-add/',
            {
                'keywords': [
                    {'keyword': 'existing', 'source': 'research'},
                    {'keyword': 'new_one', 'source': 'manual'},
                ],
            },
            format='json',
        )
        assert resp.status_code == 201
        # 'existing' skipped, 'new_one' added
        assert NicheKeyword.objects.filter(niche=niche).count() == 2


class TestNicheKeywordDetail:
    def test_delete(self, api_client, niche, user):
        kw = NicheKeyword.objects.create(
            niche=niche, keyword='delete_me', source='manual', created_by=user,
        )
        resp = api_client.delete(f'/api/niches/{niche.id}/keywords/{kw.id}/')
        assert resp.status_code == 204
        assert not NicheKeyword.objects.filter(id=kw.id).exists()

    def test_patch_group(self, api_client, niche, user):
        group = NicheKeywordGroup.objects.create(
            niche=niche, name='Primary', position=0, created_by=user,
        )
        kw = NicheKeyword.objects.create(
            niche=niche, keyword='test', source='manual', created_by=user,
        )
        resp = api_client.patch(
            f'/api/niches/{niche.id}/keywords/{kw.id}/',
            {'group': str(group.id)},
            format='json',
        )
        assert resp.status_code == 200
        kw.refresh_from_db()
        assert kw.group == group

    def test_patch_position(self, api_client, niche, user):
        kw = NicheKeyword.objects.create(
            niche=niche, keyword='test', source='manual', created_by=user,
        )
        resp = api_client.patch(
            f'/api/niches/{niche.id}/keywords/{kw.id}/',
            {'position': 5},
            format='json',
        )
        assert resp.status_code == 200
        kw.refresh_from_db()
        assert kw.position == 5


class TestNicheKeywordBulkDelete:
    def test_bulk_delete(self, api_client, niche, user):
        kw1 = NicheKeyword.objects.create(
            niche=niche, keyword='del1', source='manual', created_by=user,
        )
        kw2 = NicheKeyword.objects.create(
            niche=niche, keyword='del2', source='manual', created_by=user,
        )
        resp = api_client.post(
            f'/api/niches/{niche.id}/keywords/bulk-delete/',
            {'ids': [str(kw1.id), str(kw2.id)]},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['deleted'] == 2


# ==============================================================
# Keyword Groups CRUD
# ==============================================================

class TestKeywordGroupListCreate:
    def test_list_groups(self, api_client, niche, user):
        NicheKeywordGroup.objects.create(
            niche=niche, name='Primary', position=0, created_by=user,
        )
        resp = api_client.get(f'/api/niches/{niche.id}/keyword-groups/')
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]['name'] == 'Primary'

    def test_create_group(self, api_client, niche):
        resp = api_client.post(
            f'/api/niches/{niche.id}/keyword-groups/',
            {'name': 'Long-Tail'},
        )
        assert resp.status_code == 201
        assert resp.data['name'] == 'Long-Tail'

    def test_create_duplicate_409(self, api_client, niche, user):
        NicheKeywordGroup.objects.create(
            niche=niche, name='Primary', position=0, created_by=user,
        )
        resp = api_client.post(
            f'/api/niches/{niche.id}/keyword-groups/',
            {'name': 'Primary'},
        )
        assert resp.status_code == 409


class TestKeywordGroupDetail:
    def test_patch_name(self, api_client, niche, user):
        group = NicheKeywordGroup.objects.create(
            niche=niche, name='Old', position=0, created_by=user,
        )
        resp = api_client.patch(
            f'/api/niches/{niche.id}/keyword-groups/{group.id}/',
            {'name': 'New'},
            format='json',
        )
        assert resp.status_code == 200
        group.refresh_from_db()
        assert group.name == 'New'

    def test_delete_ungroups_keywords(self, api_client, niche, user):
        group = NicheKeywordGroup.objects.create(
            niche=niche, name='Delete Me', position=0, created_by=user,
        )
        kw = NicheKeyword.objects.create(
            niche=niche, keyword='grouped', source='manual',
            group=group, created_by=user,
        )
        resp = api_client.delete(
            f'/api/niches/{niche.id}/keyword-groups/{group.id}/',
        )
        assert resp.status_code == 204
        kw.refresh_from_db()
        assert kw.group is None
        assert NicheKeyword.objects.filter(id=kw.id).exists()


# ==============================================================
# Keyword Search
# ==============================================================

class TestKeywordSearch:
    @patch('keyword_app.api.views.get_autocomplete_suggestions')
    def test_search_returns_results(self, mock_autocomplete, api_client, niche, user):
        mock_autocomplete.return_value = ['camping shirts', 'camping humor']
        NicheKeyword.objects.create(
            niche=niche, keyword='camping dad', source='manual', created_by=user,
        )
        resp = api_client.get('/api/keywords/search/?query=camping')
        assert resp.status_code == 200
        assert resp.data['count'] >= 1
        keywords = [r['keyword'] for r in resp.data['results']]
        assert 'camping dad' in keywords

    @patch('keyword_app.api.views.get_autocomplete_suggestions')
    def test_search_no_results(self, mock_autocomplete, api_client):
        mock_autocomplete.return_value = []
        resp = api_client.get('/api/keywords/search/?query=xyznonexistent')
        assert resp.status_code == 200
        assert resp.data['count'] == 0

    def test_meta_keyword_appears_in_search(self, api_client, niche):
        """MetaKeyword results appear in search with source=listing."""
        from scraper_app.models import MetaKeyword
        MetaKeyword.objects.create(
            keyword='camping gear ideas', type='long_tail', frequency=42,
        )
        resp = api_client.get('/api/keywords/search/?query=camping+gear')
        assert resp.status_code == 200
        keywords = [r['keyword'] for r in resp.data['results']]
        assert 'camping gear ideas' in keywords

    def test_search_keyword_result_appears(self, api_client, workspace, niche):
        """SearchKeywordResult keywords appear when all_keywords_flat matches."""
        from scraper_app.models import Keyword, ProductSearchCache, SearchKeywordResult
        kw_obj = Keyword.objects.create(keyword='camping', marketplace='amazon_com')
        cache = ProductSearchCache.objects.create(
            keyword=kw_obj, workspace=workspace, status='completed',
        )
        SearchKeywordResult.objects.create(
            search_cache=cache,
            top_focus_keywords=['funny camping shirt', 'camping dad joke'],
            top_long_tail_keywords=[{'keyword': 'best camping gifts for dad'}],
            all_keywords_flat='funny camping shirt, camping dad joke, best camping gifts for dad',
        )
        resp = api_client.get('/api/keywords/search/?query=camping')
        assert resp.status_code == 200
        keywords = [r['keyword'] for r in resp.data['results']]
        assert 'funny camping shirt' in keywords
        assert 'best camping gifts for dad' in keywords

    def test_search_keyword_result_workspace_scoping(self, api_client, other_workspace):
        """SearchKeywordResult from another workspace is NOT returned."""
        from scraper_app.models import Keyword, ProductSearchCache, SearchKeywordResult
        kw_obj = Keyword.objects.create(keyword='hiking', marketplace='amazon_com')
        other_cache = ProductSearchCache.objects.create(
            keyword=kw_obj, workspace=other_workspace, status='completed',
        )
        SearchKeywordResult.objects.create(
            search_cache=other_cache,
            top_focus_keywords=['hiking secret keyword'],
            top_long_tail_keywords=[],
            all_keywords_flat='hiking secret keyword',
        )
        resp = api_client.get('/api/keywords/search/?query=hiking')
        assert resp.status_code == 200
        keywords = [r['keyword'] for r in resp.data['results']]
        assert 'hiking secret keyword' not in keywords

    def test_dedup_across_sources(self, api_client, niche, user):
        """Same keyword in NicheKeyword + MetaKeyword appears only once."""
        from scraper_app.models import MetaKeyword
        NicheKeyword.objects.create(
            niche=niche, keyword='camping humor', source='manual', created_by=user,
        )
        MetaKeyword.objects.create(
            keyword='camping humor', type='short_tail', frequency=10,
        )
        resp = api_client.get('/api/keywords/search/?query=camping+humor')
        assert resp.status_code == 200
        matching = [r for r in resp.data['results'] if r['keyword'] == 'camping humor']
        assert len(matching) == 1

    @patch('keyword_app.api.views.get_autocomplete_suggestions')
    def test_autocomplete_not_called(self, mock_autocomplete, api_client, niche, user):
        """Search endpoint no longer calls autocomplete (removed in Phase 15)."""
        NicheKeyword.objects.create(
            niche=niche, keyword='camping test', source='manual', created_by=user,
        )
        resp = api_client.get('/api/keywords/search/?query=camping')
        assert resp.status_code == 200
        mock_autocomplete.assert_not_called()

    def test_all_results_tagged_source_listing(self, api_client, niche, user):
        """Every result in search response has source=listing."""
        from scraper_app.models import MetaKeyword
        NicheKeyword.objects.create(
            niche=niche, keyword='camping dad', source='manual', created_by=user,
        )
        MetaKeyword.objects.create(
            keyword='camping shirts', type='short_tail', frequency=5,
        )
        resp = api_client.get('/api/keywords/search/?query=camping')
        assert resp.status_code == 200
        for result in resp.data['results']:
            assert result['source'] == 'listing', (
                f"Expected source=listing, got source={result['source']} "
                f"for keyword={result['keyword']}"
            )


# ==============================================================
# Keyword Enrich
# ==============================================================

class TestKeywordEnrich:
    def test_enrich_no_js_key(self, api_client):
        with patch('keyword_app.api.views.is_js_configured', return_value=False):
            resp = api_client.post(
                '/api/keywords/enrich/',
                {'keywords': ['camping'], 'marketplace': 'amazon_com'},
                format='json',
            )
        assert resp.status_code == 400
        assert 'not configured' in resp.data['error']

    @patch('keyword_app.api.views.enrich_keywords')
    @patch('keyword_app.api.views.is_js_configured', return_value=True)
    def test_enrich_success(self, mock_configured, mock_enrich, api_client):
        cache_entry = KeywordJSCache(
            keyword='camping',
            marketplace='amazon_com',
            monthly_search_volume_exact=5000,
            fetched_at=timezone.now(),
        )
        mock_enrich.return_value = {'camping': cache_entry}
        resp = api_client.post(
            '/api/keywords/enrich/',
            {'keywords': ['camping'], 'marketplace': 'amazon_com'},
            format='json',
        )
        assert resp.status_code == 200
        assert 'camping' in resp.data['data']


# ==============================================================
# Keyword Export
# ==============================================================

class TestKeywordExport:
    @patch('keyword_app.api.views.get_autocomplete_suggestions')
    def test_export_csv(self, mock_autocomplete, api_client, niche, user):
        mock_autocomplete.return_value = []
        NicheKeyword.objects.create(
            niche=niche, keyword='export_test', source='manual', created_by=user,
        )
        resp = api_client.get('/api/keywords/export/?query=export')
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'text/csv'
        content = b''.join(resp.streaming_content).decode()
        assert 'export_test' in content

    @patch('keyword_app.api.views.get_autocomplete_suggestions')
    def test_export_empty(self, mock_autocomplete, api_client):
        mock_autocomplete.return_value = []
        resp = api_client.get('/api/keywords/export/?query=nothing_here')
        assert resp.status_code == 200
        content = b''.join(resp.streaming_content).decode()
        assert 'keyword' in content  # header row present


# ==============================================================
# Auto-Import Signal
# ==============================================================

class TestAutoImport:
    def test_import_research_keywords(self, niche, user):
        """Test the auto-import service directly (signal is mocked globally)."""
        from niche_research_app.models import NicheResearch, NicheKeywordAnalysis
        from keyword_app.services.auto_import import import_research_keywords

        research = NicheResearch.objects.create(
            niche=niche, status='completed', triggered_by=user,
        )
        NicheKeywordAnalysis.objects.create(
            research=research, niche=niche,
            top_focus_keywords=['camping dad', 'outdoor humor'],
            main_short_tail=['camping', 'dad jokes'],
        )

        count = import_research_keywords(research)
        assert count == 4
        assert NicheKeyword.objects.filter(niche=niche, source='research').count() == 4

    def test_import_skips_duplicates(self, niche, user):
        from niche_research_app.models import NicheResearch, NicheKeywordAnalysis
        from keyword_app.services.auto_import import import_research_keywords

        # Pre-existing keyword
        NicheKeyword.objects.create(
            niche=niche, keyword='camping', source='manual', created_by=user,
        )

        research = NicheResearch.objects.create(
            niche=niche, status='completed', triggered_by=user,
        )
        NicheKeywordAnalysis.objects.create(
            research=research, niche=niche,
            top_focus_keywords=['camping', 'new keyword'],
            main_short_tail=[],
        )

        count = import_research_keywords(research)
        assert count == 1  # only 'new keyword' added
        assert NicheKeyword.objects.filter(niche=niche).count() == 2


# ==============================================================
# JS Call Tracker (Agent Limit)
# ==============================================================

class TestJSCallTracker:
    def test_tracker_blocks_second_call(self, niche):
        from keyword_app.services.junglescout_service import (
            check_agent_js_limit, record_agent_js_call,
        )
        assert not check_agent_js_limit(niche)
        record_agent_js_call(niche, 'camping')
        assert check_agent_js_limit(niche)

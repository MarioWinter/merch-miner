import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from idea_app.models import Idea, IdeaAdaptationRun

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='api@test.com', password='test1234')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='API Workspace', slug='api-workspace', owner=user)


@pytest.fixture
def niche(workspace):
    from niche_app.models import Niche
    return Niche.objects.create(workspace=workspace, name='Fishing', created_by=workspace.owner)


@pytest.fixture
def niche2(workspace):
    from niche_app.models import Niche
    return Niche.objects.create(workspace=workspace, name='Hunting', created_by=workspace.owner)


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace,
        niche=niche,
        slogan_text='I\'d Rather Be Fishing',
        is_manual=True,
        created_by=user,
    )


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


class TestIdeaListCreate:
    def test_list_ideas(self, client, workspace, niche, idea):
        resp = client.get(
            f'/api/niches/{niche.id}/ideas/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['slogan_text'] == idea.slogan_text

    def test_create_idea(self, client, workspace, niche):
        resp = client.post(
            f'/api/niches/{niche.id}/ideas/',
            {'slogan_text': 'New slogan'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert len(resp.data) == 1
        assert resp.data[0]['slogan_text'] == 'New slogan'
        assert resp.data[0]['is_manual'] is True

    def test_batch_create(self, client, workspace, niche):
        resp = client.post(
            f'/api/niches/{niche.id}/ideas/',
            {'slogan_text': 'Slogan 1\nSlogan 2\nSlogan 3'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert len(resp.data) == 3

    def test_create_empty_rejected(self, client, workspace, niche):
        resp = client.post(
            f'/api/niches/{niche.id}/ideas/',
            {'slogan_text': ''},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_create_idea_with_rich_metadata(self, client, workspace, niche):
        """PROJ-29 Phase 1H-2: chat-agent slogans persist full payload on create."""
        resp = client.post(
            f'/api/niches/{niche.id}/ideas/',
            {
                'slogan_text': 'Soccer Dad Energy',
                'signal_type': 'self',
                'pattern_used': 'IDENTITY_DECLARATION',
                'stylistic_device': 'DECLARATION',
                'emotional_archetype': 'Hero',
                'market_confidence': 'High',
                'creative_modules_used': ['chat_agent'],
                'status': 'approved',
            },
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201, resp.data
        row = resp.data[0]
        assert row['slogan_text'] == 'Soccer Dad Energy'
        assert row['signal_type'] == 'self'
        assert row['pattern_used'] == 'IDENTITY_DECLARATION'
        assert row['stylistic_device'] == 'DECLARATION'
        assert row['market_confidence'] == 'High'
        assert row['emotional_archetype'] == 'Hero'
        assert row['creative_modules_used'] == ['chat_agent']
        assert row['status'] == 'approved'
        assert row['is_manual'] is True

    def test_create_idea_rejects_invalid_pattern(self, client, workspace, niche):
        resp = client.post(
            f'/api/niches/{niche.id}/ideas/',
            {'slogan_text': 'X', 'pattern_used': 'NOT_A_REAL_PATTERN'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'pattern' in str(resp.data).lower()

    def test_no_workspace_header_falls_back_to_membership(self, client, niche):
        """Without X-Workspace-Id header, fallback resolves via active membership."""
        resp = client.get(f'/api/niches/{niche.id}/ideas/')
        assert resp.status_code == 200

    def test_workspace_isolation(self, client, niche):
        other_ws_id = str(uuid.uuid4())
        resp = client.get(
            f'/api/niches/{niche.id}/ideas/',
            HTTP_X_WORKSPACE_ID=other_ws_id,
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 0


class TestIdeaDetail:
    def test_update_status(self, client, workspace, idea):
        resp = client.patch(
            f'/api/ideas/{idea.id}/',
            {'status': 'approved'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        idea.refresh_from_db()
        assert idea.status == 'approved'

    def test_delete_idea(self, client, workspace, idea):
        resp = client.delete(
            f'/api/ideas/{idea.id}/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not Idea.objects.filter(id=idea.id).exists()

    def test_404_wrong_workspace(self, client, idea):
        resp = client.patch(
            f'/api/ideas/{idea.id}/',
            {'status': 'approved'},
            format='json',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 404


class TestIdeaAdapt:
    def test_adapt_no_niche_returns_400(self, client, workspace, user):
        idea_no_niche = Idea.objects.create(
            workspace=workspace,
            slogan_text='No niche',
            created_by=user,
        )
        resp = client.post(
            f'/api/ideas/{idea_no_niche.id}/adapt/',
            {'target_niche_ids': [str(uuid.uuid4())]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400
        assert 'niche' in resp.data['error'].lower()

    def test_adapt_creates_run(self, client, workspace, idea, niche2):
        resp = client.post(
            f'/api/ideas/{idea.id}/adapt/',
            {'target_niche_ids': [str(niche2.id)]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['status'] == 'pending'
        assert IdeaAdaptationRun.objects.filter(source_idea=idea).exists()

    def test_adapt_409_duplicate(self, client, workspace, idea, niche2):
        # First run
        client.post(
            f'/api/ideas/{idea.id}/adapt/',
            {'target_niche_ids': [str(niche2.id)]},
            format='json',
            **_ws_headers(workspace),
        )
        # Second run — should 409
        resp = client.post(
            f'/api/ideas/{idea.id}/adapt/',
            {'target_niche_ids': [str(niche2.id)]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 409

    def test_adapt_empty_targets(self, client, workspace, idea):
        resp = client.post(
            f'/api/ideas/{idea.id}/adapt/',
            {'target_niche_ids': []},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400


class TestAdaptationRunDetail:
    def test_get_run(self, client, workspace, idea, user):
        run = IdeaAdaptationRun.objects.create(
            workspace=workspace,
            source_idea=idea,
            target_niche_ids=[str(uuid.uuid4())],
            triggered_by=user,
        )
        resp = client.get(
            f'/api/ideas/adaptation-runs/{run.id}/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'pending'

    def test_run_404_wrong_workspace(self, client, workspace, idea, user):
        run = IdeaAdaptationRun.objects.create(
            workspace=workspace,
            source_idea=idea,
            target_niche_ids=[],
            triggered_by=user,
        )
        resp = client.get(
            f'/api/ideas/adaptation-runs/{run.id}/',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 404


class TestBulkStatus:
    def test_bulk_approve(self, client, workspace, niche, user):
        ideas = [
            Idea.objects.create(
                workspace=workspace, niche=niche, slogan_text=f'S{i}', created_by=user,
            )
            for i in range(3)
        ]
        ids = [str(i.id) for i in ideas]
        resp = client.post(
            '/api/ideas/bulk-status/',
            {'ids': ids, 'status': 'approved'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['updated'] == 3

    def test_bulk_wrong_workspace(self, client, workspace, niche, user):
        idea = Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='X', created_by=user,
        )
        resp = client.post(
            '/api/ideas/bulk-status/',
            {'ids': [str(idea.id)], 'status': 'rejected'},
            format='json',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 200
        assert resp.data['updated'] == 0  # workspace isolation


class TestWorkspaceListCreate:
    """Tests for GET/POST /api/ideas/ (workspace-wide)."""

    def test_list_all_ideas(self, client, workspace, niche, idea):
        resp = client.get('/api/ideas/', **_ws_headers(workspace))
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['id'] == str(idea.id)

    def test_list_filter_by_niche(self, client, workspace, niche, niche2, user):
        Idea.objects.create(workspace=workspace, niche=niche, slogan_text='A', created_by=user)
        Idea.objects.create(workspace=workspace, niche=niche2, slogan_text='B', created_by=user)
        resp = client.get(
            f'/api/ideas/?niche_id={niche.id}', **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['slogan_text'] == 'A'

    def test_list_filter_by_status(self, client, workspace, niche, user):
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='Approved',
            status='approved', created_by=user,
        )
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='Pending',
            status='pending', created_by=user,
        )
        resp = client.get(
            '/api/ideas/?status=approved', **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['status'] == 'approved'

    def test_list_filter_orphans(self, client, workspace, niche, user):
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='Has niche', created_by=user,
        )
        Idea.objects.create(
            workspace=workspace, niche=None, slogan_text='Orphan', created_by=user,
        )
        resp = client.get(
            '/api/ideas/?is_orphan=true', **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['slogan_text'] == 'Orphan'

    def test_list_ordering(self, client, workspace, niche, user):
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='Zebra', created_by=user,
        )
        Idea.objects.create(
            workspace=workspace, niche=niche, slogan_text='Alpha', created_by=user,
        )
        resp = client.get(
            '/api/ideas/?ordering=slogan_text', **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        texts = [r['slogan_text'] for r in resp.data['results']]
        assert texts == sorted(texts)

    def test_list_invalid_ordering_ignored(self, client, workspace, niche, idea):
        resp = client.get(
            '/api/ideas/?ordering=invalid_field', **_ws_headers(workspace),
        )
        assert resp.status_code == 200

    def test_create_with_niche(self, client, workspace, niche):
        resp = client.post(
            '/api/ideas/',
            {'slogan_text': 'Workspace idea', 'niche': str(niche.id)},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert len(resp.data) == 1
        assert str(resp.data[0]['niche']) == str(niche.id)

    def test_create_without_niche(self, client, workspace):
        resp = client.post(
            '/api/ideas/',
            {'slogan_text': 'Orphan idea'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data[0]['niche'] is None

    def test_create_batch(self, client, workspace):
        resp = client.post(
            '/api/ideas/',
            {'slogan_text': 'Line1\nLine2'},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert len(resp.data) == 2

    def test_workspace_isolation(self, client, workspace, idea):
        resp = client.get(
            '/api/ideas/',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 200
        assert resp.data['count'] == 0


class TestIdeaImport:
    """Tests for POST /api/ideas/import/."""

    def test_import_basic(self, client, workspace):
        resp = client.post(
            '/api/ideas/import/',
            {'ideas': [
                {'slogan_text': 'Imported 1'},
                {'slogan_text': 'Imported 2'},
            ]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['created'] == 2
        assert resp.data['warnings'] == []

    def test_import_niche_matching(self, client, workspace, niche):
        resp = client.post(
            '/api/ideas/import/',
            {'ideas': [
                {'slogan_text': 'With niche', 'niche_name': 'Fishing'},
                {'slogan_text': 'Case insensitive', 'niche_name': 'fishing'},
            ]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['created'] == 2
        assert resp.data['warnings'] == []
        assert Idea.objects.filter(
            workspace=workspace, niche=niche,
        ).count() == 2

    def test_import_unmatched_niche_warning(self, client, workspace):
        resp = client.post(
            '/api/ideas/import/',
            {'ideas': [
                {'slogan_text': 'S1', 'niche_name': 'NonExistent'},
                {'slogan_text': 'S2', 'niche_name': 'NonExistent'},
            ]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['created'] == 2
        assert len(resp.data['warnings']) == 1
        assert 'NonExistent' in resp.data['warnings'][0]
        assert '2' in resp.data['warnings'][0]

    def test_import_max_limit(self, client, workspace):
        items = [{'slogan_text': f'S{i}'} for i in range(501)]
        resp = client.post(
            '/api/ideas/import/',
            {'ideas': items},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_import_empty_list(self, client, workspace):
        resp = client.post(
            '/api/ideas/import/',
            {'ideas': []},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_import_empty_slogan_rejected(self, client, workspace):
        resp = client.post(
            '/api/ideas/import/',
            {'ideas': [{'slogan_text': '  '}]},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400


class TestFilterTemplateCRUD:
    """Tests for /api/ideas/filter-templates/ CRUD."""

    def test_create_template(self, client, workspace):
        resp = client.post(
            '/api/ideas/filter-templates/',
            {'name': 'My Filter', 'filters': {'status': 'approved'}},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 201
        assert resp.data['name'] == 'My Filter'
        assert resp.data['filters'] == {'status': 'approved'}

    def test_list_templates(self, client, workspace, user):
        from idea_app.models import IdeaFilterTemplate
        IdeaFilterTemplate.objects.create(
            workspace=workspace, name='T1', filters={}, created_by=user,
        )
        IdeaFilterTemplate.objects.create(
            workspace=workspace, name='T2', filters={}, created_by=user,
        )
        resp = client.get(
            '/api/ideas/filter-templates/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert len(resp.data) == 2

    def test_update_template(self, client, workspace, user):
        from idea_app.models import IdeaFilterTemplate
        t = IdeaFilterTemplate.objects.create(
            workspace=workspace, name='Old', filters={}, created_by=user,
        )
        resp = client.patch(
            f'/api/ideas/filter-templates/{t.id}/',
            {'name': 'New', 'filters': {'signal_type': 'self'}},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert resp.data['name'] == 'New'
        assert resp.data['filters'] == {'signal_type': 'self'}

    def test_delete_template(self, client, workspace, user):
        from idea_app.models import IdeaFilterTemplate
        t = IdeaFilterTemplate.objects.create(
            workspace=workspace, name='Del', filters={}, created_by=user,
        )
        resp = client.delete(
            f'/api/ideas/filter-templates/{t.id}/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 204
        assert not IdeaFilterTemplate.objects.filter(id=t.id).exists()

    def test_workspace_isolation(self, client, workspace, user):
        from idea_app.models import IdeaFilterTemplate
        t = IdeaFilterTemplate.objects.create(
            workspace=workspace, name='Isolated', filters={}, created_by=user,
        )
        resp = client.get(
            '/api/ideas/filter-templates/',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 200
        assert len(resp.data) == 0

        # Cannot update from other workspace
        resp = client.patch(
            f'/api/ideas/filter-templates/{t.id}/',
            {'name': 'Hacked'},
            format='json',
            HTTP_X_WORKSPACE_ID=str(uuid.uuid4()),
        )
        assert resp.status_code == 404

    def test_invalid_filter_keys(self, client, workspace):
        resp = client.post(
            '/api/ideas/filter-templates/',
            {'name': 'Bad', 'filters': {'unknown_key': 'val'}},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_empty_name_rejected(self, client, workspace):
        resp = client.post(
            '/api/ideas/filter-templates/',
            {'name': '', 'filters': {}},
            format='json',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400


class TestSuggestNiches:
    def test_suggest_requires_niche(self, client, workspace, user):
        idea = Idea.objects.create(workspace=workspace, slogan_text='No niche', created_by=user)
        resp = client.get(
            f'/api/ideas/{idea.id}/suggest-niches/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 400

    def test_suggest_returns_list(self, client, workspace, idea, niche2):
        resp = client.get(
            f'/api/ideas/{idea.id}/suggest-niches/',
            **_ws_headers(workspace),
        )
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
        # niche2 should be in suggestions (it's in the same workspace)
        niche_ids = [s['niche_id'] for s in resp.data]
        assert str(niche2.id) in niche_ids

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

    def test_no_workspace_header(self, client, niche):
        resp = client.get(f'/api/niches/{niche.id}/ideas/')
        assert resp.status_code == 400

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

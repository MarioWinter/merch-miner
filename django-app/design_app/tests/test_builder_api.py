"""PROJ-34 Phase 5 + 6 — Builder Build API + BuilderPreset CRUD tests."""

import uuid
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from design_app.models import (
    BuilderPreset,
    DesignProject,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='proj34@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Workspace, Membership
    ws = Workspace.objects.create(name='WS 34', slug='ws-34', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def project(workspace, user):
    return DesignProject.objects.create(
        workspace=workspace, name='School Bus Set', created_by=user,
    )


@pytest.fixture
def auth_client(user, workspace):
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return c


# ---- /builder/build/ ----------------------------------------------------------


class TestBuilderBuild:
    URL = '/api/designs/projects/{pid}/builder/build/'

    def test_happy_path_5x3_polish_off(self, auth_client, project):
        """AC-34/AC-36/AC-37: 5 slogans × 3 styles → 15 prompts in order."""
        url = self.URL.format(pid=project.id)
        # Polish OFF — no LLM call, deterministic output we can pin down.
        resp = auth_client.post(
            url,
            data={
                'slogans': ['A', 'B', 'C', 'D', 'E'],
                'styles': ['vintage_retro', '80s_neon', 'cartoon'],
                'background_color': 'neon_pink',
                'with_polish': False,
                'include_niche_context': False,
            },
            format='json',
        )
        assert resp.status_code == 200, resp.content
        prompts = resp.json()['prompts']
        assert len(prompts) == 15  # 5 * 3
        # AC-7 + Architect template: bg hex + slogan + style label present.
        assert '"A"' in prompts[0]
        assert 'Vintage Retro' in prompts[0]
        assert '#FF6EC7' in prompts[0]
        # Cross-product order: slogan stays at outer loop.
        assert '"A"' in prompts[1] and '80s Neon Synthwave' in prompts[1]
        assert '"E"' in prompts[14] and 'Cartoon' in prompts[14]

    @patch('design_app.api.views.polish_prompt', create=True)
    def test_polish_runs_when_with_polish_true(self, _patched, auth_client, project):
        """AC-16: with_polish=true triggers polish_prompt() per raw prompt."""
        # Note: we patch via the lazy import path inside _maybe_polish_parallel.
        with patch(
            'design_app.services.prompt_polish.polish_prompt',
            side_effect=lambda raw, **kw: f'<polished>{raw}</polished>',
        ) as mock_polish:
            url = self.URL.format(pid=project.id)
            resp = auth_client.post(
                url,
                data={
                    'slogans': ['Hello'],
                    'styles': ['cartoon'],
                    'background_color': 'light_gray',
                    'with_polish': True,
                    'include_niche_context': False,
                },
                format='json',
            )
            assert resp.status_code == 200
            prompts = resp.json()['prompts']
            assert len(prompts) == 1
            assert prompts[0].startswith('<polished>')
            assert mock_polish.call_count == 1

    def test_polish_disabled_when_workspace_setting_off(self, auth_client, project, workspace):
        """EC-7: workspace polish_builder_prompts_enabled=False wins over request flag."""
        from design_app.models import ProcessingSettings
        ProcessingSettings.objects.create(
            workspace=workspace, polish_builder_prompts_enabled=False,
        )
        with patch(
            'design_app.services.prompt_polish.polish_prompt',
        ) as mock_polish:
            url = self.URL.format(pid=project.id)
            resp = auth_client.post(
                url,
                data={
                    'slogans': ['X'],
                    'styles': ['cartoon'],
                    'with_polish': True,  # but workspace says NO
                    'include_niche_context': False,
                },
                format='json',
            )
            assert resp.status_code == 200
            mock_polish.assert_not_called()

    def test_empty_slogans_returns_400(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={'slogans': [], 'styles': ['cartoon']},
            format='json',
        )
        assert resp.status_code == 400

    def test_empty_styles_returns_400(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={'slogans': ['X'], 'styles': []},
            format='json',
        )
        assert resp.status_code == 400

    def test_cross_workspace_project_returns_404(self, auth_client, user):
        """Tenant isolation: project from a different workspace is 404."""
        from workspace_app.models import Workspace
        other = Workspace.objects.create(name='Other', slug='other', owner=user)
        other_project = DesignProject.objects.create(
            workspace=other, name='not-mine', created_by=user,
        )
        url = self.URL.format(pid=other_project.id)
        resp = auth_client.post(
            url,
            data={'slogans': ['x'], 'styles': ['cartoon'], 'with_polish': False},
            format='json',
        )
        assert resp.status_code == 404

    def test_warp_phrase_injected(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={
                'slogans': ['BUS LIFE'],
                'styles': ['cartoon'],
                'warp': 'arc_lower',
                'with_polish': False,
                'include_niche_context': False,
            },
            format='json',
        )
        assert resp.status_code == 200
        prompt = resp.json()['prompts'][0]
        assert 'Arc Lower' in prompt


# ---- /builder-presets/ -------------------------------------------------------


class TestBuilderPresetCRUD:
    URL = '/api/designs/projects/{pid}/builder-presets/'

    def test_create_list_rename_delete(self, auth_client, project, workspace, user):
        # CREATE
        resp = auth_client.post(
            self.URL.format(pid=project.id),
            data={'name': 'Set v1', 'config': {'slogans': ['hello']}},
            format='json',
        )
        assert resp.status_code == 201, resp.content
        preset_id = resp.json()['id']

        # LIST
        resp = auth_client.get(self.URL.format(pid=project.id))
        assert resp.status_code == 200
        rows = resp.json()
        assert len(rows) == 1
        assert rows[0]['name'] == 'Set v1'

        # PATCH (rename)
        resp = auth_client.patch(
            self.URL.format(pid=project.id) + f'{preset_id}/',
            data={'name': 'Set v2'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.json()['name'] == 'Set v2'

        # DELETE (soft)
        resp = auth_client.delete(
            self.URL.format(pid=project.id) + f'{preset_id}/',
        )
        assert resp.status_code == 204
        preset = BuilderPreset.objects.get(pk=preset_id)
        assert preset.is_deleted is True

        # Soft-deleted row not in LIST.
        resp = auth_client.get(self.URL.format(pid=project.id))
        assert resp.json() == []

    def test_duplicate_name_returns_400(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        auth_client.post(
            url, data={'name': 'dup', 'config': {}}, format='json',
        )
        resp = auth_client.post(
            url, data={'name': 'dup', 'config': {}}, format='json',
        )
        assert resp.status_code == 400
        assert 'already exists' in resp.json().get('error', '').lower()

    def test_reuse_name_after_soft_delete(self, auth_client, project):
        """EC-19 partial unique allows name re-use after soft-delete."""
        url = self.URL.format(pid=project.id)
        r1 = auth_client.post(
            url, data={'name': 'reusable', 'config': {}}, format='json',
        )
        pid = r1.json()['id']
        auth_client.delete(url + f'{pid}/')
        r2 = auth_client.post(
            url, data={'name': 'reusable', 'config': {}}, format='json',
        )
        assert r2.status_code == 201

    def test_cross_workspace_isolation_on_list(self, auth_client, user):
        from workspace_app.models import Workspace
        other = Workspace.objects.create(name='Other', slug='o-2', owner=user)
        other_project = DesignProject.objects.create(
            workspace=other, name='x', created_by=user,
        )
        # Try to GET — different workspace → project not found in caller's ws.
        resp = auth_client.get(self.URL.format(pid=other_project.id))
        assert resp.status_code == 404

    def test_invalid_preset_id_404(self, auth_client, project):
        bogus = uuid.uuid4()
        resp = auth_client.patch(
            self.URL.format(pid=project.id) + f'{bogus}/',
            data={'name': 'x'},
            format='json',
        )
        assert resp.status_code == 404

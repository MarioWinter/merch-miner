"""PROJ-34 Phase 13c.5 / AC-56 — Tests for `BuilderNicheHintsView`.

GET /api/designs/projects/{id}/builder/niche-hints/

Returns the structured `Niche.builder_form_hints` dict + niche_id +
last_updated. When the project has no niche or the niche has no hints,
returns null trio. Workspace isolation via `X-Workspace-Id` header.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from design_app.models import DesignProject

pytestmark = pytest.mark.django_db


URL = '/api/designs/projects/{pid}/builder/niche-hints/'


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='hintsview@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Hints WS', slug='hints-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def project(workspace, user):
    return DesignProject.objects.create(
        workspace=workspace, name='Hints Project', created_by=user,
    )


@pytest.fixture
def auth_client(user, workspace):
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return c


class TestBuilderNicheHintsView:
    def test_get_returns_hints_when_project_has_niche_with_hints(
        self, auth_client, project, workspace, user,
    ):
        from niche_app.models import Niche
        hints = {
            '_schema_version': 2,
            '_generated_at': '2026-05-18T10:00:00+00:00',
            'spatial': 'vertical_stack',
            'visual': 'a school bus driver illustration',
            'accessories': None,
            'material': None,
        }
        niche = Niche.objects.create(
            workspace=workspace, name='School Buses', created_by=user,
            builder_form_hints=hints,
        )
        project.niche = niche
        project.save(update_fields=['niche'])

        resp = auth_client.get(URL.format(pid=project.id))

        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body['builder_form_hints'] == hints
        assert body['niche_id'] == str(niche.id)
        assert body['last_updated'] == '2026-05-18T10:00:00+00:00'

    def test_get_returns_null_trio_when_project_has_no_niche(
        self, auth_client, project,
    ):
        resp = auth_client.get(URL.format(pid=project.id))

        assert resp.status_code == 200, resp.content
        assert resp.json() == {
            'builder_form_hints': None,
            'niche_id': None,
            'last_updated': None,
        }

    def test_get_returns_null_when_niche_has_no_hints(
        self, auth_client, project, workspace, user,
    ):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='Empty Niche', created_by=user,
        )
        project.niche = niche
        project.save(update_fields=['niche'])

        resp = auth_client.get(URL.format(pid=project.id))

        assert resp.status_code == 200, resp.content
        body = resp.json()
        assert body['builder_form_hints'] is None
        assert body['niche_id'] == str(niche.id)
        assert body['last_updated'] is None

    def test_get_requires_auth(self, project):
        c = APIClient()
        resp = c.get(URL.format(pid=project.id))
        assert resp.status_code == 401

    def test_get_cross_workspace_returns_404(self, auth_client, user):
        """Tenant isolation: project in another workspace → 404."""
        from workspace_app.models import Workspace
        other_ws = Workspace.objects.create(
            name='Other', slug='other-ws', owner=user,
        )
        other_project = DesignProject.objects.create(
            workspace=other_ws, name='not-mine', created_by=user,
        )

        resp = auth_client.get(URL.format(pid=other_project.id))

        assert resp.status_code == 404

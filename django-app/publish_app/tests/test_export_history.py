"""Phase T5: ExportLog history tests (PROJ-11).

Covers AC-114 / AC-115 / AC-116 + EC-67 semantics:
- Append-only (row written on 200, not on 4xx/5xx)
- Workspace-isolated list
- Ordered newest-first
- Cross-workspace design_id returns 404 (no leakage, no row)
"""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from publish_app.models import DesignAsset, ExportLog
from publish_app.tests._flyingupload_factories import (  # noqa: F401
    fu_idea,
    fu_membership,
    fu_niche,
    fu_user,
    fu_workspace,
    make_design,
    make_global_listing,
    make_mba_listing,
    make_product_config,
    png_bytes,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def api_client(fu_user, fu_membership):
    client = APIClient()
    client.force_authenticate(user=fu_user)
    return client


def ws_headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _setup_exportable_design(fu_workspace, fu_user, fu_idea, png_bytes):
    design = make_design(
        fu_workspace, fu_user, file_name='cat.png', png_bytes=png_bytes,
    )
    make_mba_listing(fu_workspace, fu_idea, design)
    make_global_listing(
        fu_workspace, fu_idea, design,
        keywords={'en': ['cat']}, type_flags=['men'], color_mode='black',
    )
    make_product_config(design)
    return design


@pytest.fixture
def other_workspace(db):
    other_user = User.objects.create_user(
        email='other@example.com', password='testpass123',
    )
    ws = Workspace.objects.create(
        name='Other WS', slug='other-ws', owner=other_user,
    )
    Membership.objects.create(
        workspace=ws, user=other_user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )
    return ws, other_user


# ---------------------------------------------------------------------------
# Append-only semantics (AC-116)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestExportLogAppendOnly:
    def test_append_only_on_successful_export(
        self, api_client, fu_workspace, fu_user, fu_idea, png_bytes,
    ):
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
        )
        assert ExportLog.objects.count() == 0
        resp = api_client.post(
            '/api/publish/export/flyingupload/',
            {
                'template': 'mba',
                'format': 'xlsx',
                'design_ids': [str(design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 200
        assert ExportLog.objects.count() == 1
        row = ExportLog.objects.get()
        assert row.workspace_id == fu_workspace.id
        assert row.created_by_id == fu_user.id
        assert row.design_ids == [str(design.id)]

    def test_no_row_on_4xx_error(
        self, api_client, fu_workspace,
    ):
        # Invalid template -> 400 from serializer.
        resp = api_client.post(
            '/api/publish/export/flyingupload/',
            {
                'template': 'bogus',
                'format': 'xlsx',
                'design_ids': ['00000000-0000-0000-0000-000000000000'],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 400
        assert ExportLog.objects.count() == 0

    def test_no_row_on_5xx_error(
        self, api_client, fu_workspace, fu_user, fu_idea, png_bytes, monkeypatch,
    ):
        """Force a 500 by patching build_mba_bundle to raise."""
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
        )

        def _boom(*_args, **_kwargs):
            raise RuntimeError('synthetic pipeline crash')

        monkeypatch.setattr(
            'publish_app.api.views.flyingupload_export.build_mba_bundle',
            _boom,
        )
        resp = api_client.post(
            '/api/publish/export/flyingupload/',
            {
                'template': 'mba',
                'format': 'xlsx',
                'design_ids': [str(design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 500
        assert ExportLog.objects.count() == 0


# ---------------------------------------------------------------------------
# /history/ list endpoint (AC-115)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestExportHistoryListView:
    def test_workspace_isolated_list(
        self,
        api_client,
        fu_workspace,
        fu_user,
        fu_idea,
        png_bytes,
        other_workspace,
    ):
        # One log in fu_workspace.
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
        )
        api_client.post(
            '/api/publish/export/flyingupload/',
            {
                'template': 'mba',
                'format': 'xlsx',
                'design_ids': [str(design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        # One manually-injected log in the OTHER workspace.
        other_ws, other_user = other_workspace
        ExportLog.objects.create(
            workspace=other_ws,
            created_by=other_user,
            template='mba',
            format='xlsx',
            design_ids=[],
            design_count=0,
            row_count=0,
            filename='other.zip',
            output_size_bytes=1,
        )

        resp = api_client.get(
            '/api/publish/export/history/',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 200
        results = resp.data.get('results', resp.data)
        assert len(results) == 1
        assert results[0]['filename'].endswith('.zip')

    def test_ordered_newest_first(
        self, api_client, fu_workspace, fu_user,
    ):
        # Manually create 3 log rows and verify order.
        for i in range(3):
            ExportLog.objects.create(
                workspace=fu_workspace,
                created_by=fu_user,
                template='mba',
                format='xlsx',
                design_ids=[],
                design_count=0,
                row_count=0,
                filename=f'export-{i}.zip',
                output_size_bytes=100 + i,
            )
        resp = api_client.get(
            '/api/publish/export/history/',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 200
        results = resp.data.get('results', resp.data)
        filenames = [row['filename'] for row in results]
        # Newest first => export-2 before export-1 before export-0.
        assert filenames == ['export-2.zip', 'export-1.zip', 'export-0.zip']

    def test_cross_workspace_design_id_returns_404(
        self, api_client, fu_workspace, other_workspace,
    ):
        """Design belonging to another workspace must not be exportable.

        The view must reject with 404 (treated as "no matching designs in
        workspace") and write no ExportLog row.
        """
        other_ws, other_user = other_workspace
        foreign_design = DesignAsset.objects.create(
            workspace=other_ws,
            file_name='foreign.png',
            source=DesignAsset.Source.UPLOAD,
            created_by=other_user,
        )
        resp = api_client.post(
            '/api/publish/export/flyingupload/',
            {
                'template': 'mba',
                'format': 'xlsx',
                'design_ids': [str(foreign_design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 404
        assert ExportLog.objects.count() == 0

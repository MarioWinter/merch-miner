"""Phase T5: FlyingUpload export/preflight view tests (PROJ-11).

Covers AC-91 / AC-111 / AC-113 / AC-136. Uses the Phase-S factories via
``_flyingupload_factories`` to build a minimally-complete MBA export.
"""

from __future__ import annotations

import io
import zipfile

import pytest
from rest_framework.test import APIClient

from publish_app.models import ExportLog
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
    make_mba_listing(fu_workspace, fu_idea, design, title='Cat Tee')
    make_global_listing(
        fu_workspace, fu_idea, design,
        keywords={'en': ['cat']}, type_flags=['men'], color_mode='black',
    )
    make_product_config(design)
    return design


# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestFlyingUploadPreflightView:
    def test_preflight_no_side_effects(
        self, api_client, fu_workspace, fu_user, fu_idea, png_bytes,
    ):
        """Preflight returns a summary without writing an ExportLog row."""
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
        )
        resp = api_client.post(
            '/api/publish/export/flyingupload/preflight/',
            {
                'template': 'mba',
                'format': 'xlsx',
                'design_ids': [str(design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['template'] == 'mba'
        assert resp.data['total_designs'] == 1
        assert resp.data['ready_rows'] == 1
        # Hard guarantee: preflight is read-only.
        assert ExportLog.objects.count() == 0

    def test_preflight_rejects_unknown_template(
        self, api_client, fu_workspace, fu_user, fu_idea, png_bytes,
    ):
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
        )
        resp = api_client.post(
            '/api/publish/export/flyingupload/preflight/',
            {
                'template': 'bogus',
                'format': 'xlsx',
                'design_ids': [str(design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Download — XLSX (ZIP)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestFlyingUploadExportViewZip:
    def test_download_returns_zip_for_xlsx(
        self, api_client, fu_workspace, fu_user, fu_idea, png_bytes,
    ):
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
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
        assert resp.status_code == 200, getattr(resp, 'data', resp.content)
        assert resp['Content-Type'].startswith('application/zip')
        body = b''.join(resp.streaming_content) if resp.streaming else resp.content
        # Valid ZIP archive.
        zf = zipfile.ZipFile(io.BytesIO(body))
        names = zf.namelist()
        assert any(n.endswith('.xlsx') for n in names)
        assert any(n.startswith('designs/') for n in names)
        # ExportLog row written.
        row = ExportLog.objects.get()
        assert row.template == 'mba'
        assert row.format == 'xlsx'
        assert row.design_count == 1
        assert row.row_count == 1
        assert row.output_size_bytes == len(body)
        assert row.filename.endswith('.zip')

    def test_content_disposition_rfc5987_for_unicode_workspace_name(
        self, api_client, fu_user, fu_idea, png_bytes, fu_workspace,
    ):
        # Rename the fixture workspace to include non-ASCII characters
        # so the Content-Disposition header has to use RFC 5987 encoding.
        fu_workspace.name = 'Katzen Läden ✨'
        fu_workspace.save(update_fields=['name'])

        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
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
        assert resp.status_code == 200
        cd = resp['Content-Disposition']
        # 7-bit fallback and UTF-8 star parameter must both be present.
        assert cd.startswith('attachment; ')
        assert 'filename=' in cd
        assert "filename*=UTF-8''" in cd


# ---------------------------------------------------------------------------
# Download — CSV (plain)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestFlyingUploadExportViewCsv:
    def test_download_returns_plain_csv_for_csv(
        self, api_client, fu_workspace, fu_user, fu_idea, png_bytes,
    ):
        design = _setup_exportable_design(
            fu_workspace, fu_user, fu_idea, png_bytes,
        )
        resp = api_client.post(
            '/api/publish/export/flyingupload/',
            {
                'template': 'mba',
                'format': 'csv',
                'design_ids': [str(design.id)],
            },
            format='json',
            **ws_headers(fu_workspace),
        )
        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/csv')
        body = resp.content
        # UTF-8 BOM preserved by the service layer.
        assert body.startswith(b'\xef\xbb\xbf')
        row = ExportLog.objects.get()
        assert row.format == 'csv'
        assert row.filename.endswith('.csv')
        assert row.output_size_bytes == len(body)

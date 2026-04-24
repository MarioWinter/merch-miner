"""Phase S7: Basic XLSX export tests."""

from __future__ import annotations

import pytest

from publish_app.services.flyingupload_export import build_basic_bundle
from publish_app.tests._flyingupload_factories import (
    fu_idea,  # noqa: F401
    fu_membership,  # noqa: F401
    fu_niche,  # noqa: F401
    fu_user,  # noqa: F401
    fu_workspace,  # noqa: F401
    make_design,
    make_global_listing,
    png_bytes,  # noqa: F401
    read_xlsx_from_zip,
)


class TestBasicExport:
    def test_9_columns_exact(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-95: Basic template = 9 columns."""
        design = make_design(
            fu_workspace, fu_user, file_name='b9.png', png_bytes=png_bytes,
        )
        make_global_listing(
            fu_workspace, fu_idea, design,
            keywords={'en': ['a'], 'de': ['b']},
            type_flags=['men'],
            color_mode='black',
        )
        zip_bytes, summary = build_basic_bundle(
            str(fu_workspace.id), [str(design.id)],
        )
        assert summary['template'] == 'basic'
        assert summary['ready_rows'] == 1
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        assert ws.max_column == 9
        # Headers.
        assert ws.cell(row=1, column=1).value == 'Image Path'
        assert ws.cell(row=1, column=2).value == 'Title DE'
        assert ws.cell(row=1, column=5).value == 'Title EN'
        assert ws.cell(row=1, column=8).value == 'Type'
        assert ws.cell(row=1, column=9).value == 'Color'

    def test_men_maps_to_man(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-96: men->man, women->woman legacy mapping."""
        design = make_design(
            fu_workspace, fu_user, file_name='bmw.png', png_bytes=png_bytes,
        )
        make_global_listing(
            fu_workspace, fu_idea, design,
            type_flags=['men', 'women', 'youth'],
            color_mode='colorful',
        )
        zip_bytes, _ = build_basic_bundle(
            str(fu_workspace.id), [str(design.id)],
        )
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        assert ws.cell(row=2, column=8).value == 'man, woman, youth'
        assert ws.cell(row=2, column=9).value == 'colorful'

    def test_skips_missing_global_listing(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-97: designs without a Global listing are skipped."""
        design = make_design(
            fu_workspace, fu_user, file_name='miss.png', png_bytes=png_bytes,
        )
        # No Global listing.
        _zip, summary = build_basic_bundle(
            str(fu_workspace.id), [str(design.id)],
        )
        assert summary['ready_rows'] == 0
        assert len(summary['skipped']) == 1
        assert summary['skipped'][0]['reason'] == 'no_global_listing'

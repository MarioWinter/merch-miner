"""Phase S7: Guardrail + collision tests."""

from __future__ import annotations

import pytest

from publish_app.services.flyingupload_export import (
    ExportError,
    build_mba_bundle,
    preflight,
)
from publish_app.tests._flyingupload_factories import (
    fu_idea,  # noqa: F401
    fu_membership,  # noqa: F401
    fu_niche,  # noqa: F401
    fu_user,  # noqa: F401
    fu_workspace,  # noqa: F401
    list_zip_entries,
    make_design,
    make_global_listing,
    make_mba_listing,
    make_product_config,
    png_bytes,  # noqa: F401
)


class TestGuards:
    def test_max_500_cap(
        self, fu_workspace, fu_membership, fu_user,
    ):
        """AC-107: 501 design_ids -> max_500_designs_per_export."""
        import uuid as _uuid

        ids = [str(_uuid.uuid4()) for _ in range(501)]
        with pytest.raises(ExportError) as exc:
            preflight(str(fu_workspace.id), ids, template='mba')
        assert exc.value.code == 'max_500_designs_per_export'

    def test_size_estimate_cap(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-107: sum(file_size) > 500 MB -> estimated_archive_too_large."""
        design = make_design(
            fu_workspace, fu_user, file_name='big.png', png_bytes=png_bytes,
        )
        # Hack the file_size so estimate overflows the cap without having to
        # store a real 600 MB binary.
        design.file_size = 600 * 1024 * 1024
        design.save(update_fields=['file_size'])
        make_mba_listing(fu_workspace, fu_idea, design)
        make_product_config(design)
        with pytest.raises(ExportError) as exc:
            preflight(str(fu_workspace.id), [str(design.id)], template='mba')
        assert exc.value.code == 'estimated_archive_too_large'
        assert 'top_designs' in exc.value.details

    def test_filename_collision_suffix(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-106: two designs sharing file_name get UUID-suffixed safe names."""
        d1 = make_design(
            fu_workspace, fu_user, file_name='color-design.png',
            png_bytes=png_bytes,
        )
        d2 = make_design(
            fu_workspace, fu_user, file_name='color-design.png',
            png_bytes=png_bytes,
        )
        for d in (d1, d2):
            make_mba_listing(fu_workspace, fu_idea, d)
            make_global_listing(fu_workspace, fu_idea, d)
            make_product_config(d)
        zip_bytes, summary = build_mba_bundle(
            str(fu_workspace.id), [str(d1.id), str(d2.id)],
        )
        assert summary['ready_rows'] == 2
        names = list_zip_entries(zip_bytes)
        image_names = sorted(n for n in names if n.startswith('designs/'))
        assert len(image_names) == 2
        assert image_names[0] != image_names[1]
        # Both follow the `<stem>-<uuid8>.png` pattern.
        for n in image_names:
            basename = n.rsplit('/', 1)[-1]
            stem = basename.rsplit('.', 1)[0]
            assert stem.startswith('color-design-'), basename
            suffix = stem.rsplit('-', 1)[-1]
            assert len(suffix) == 8

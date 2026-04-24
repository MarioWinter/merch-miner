"""Phase S7: CSV format export tests."""

from __future__ import annotations

from publish_app.services.flyingupload_export import (
    build_basic_csv,
    build_mba_csv,
)
from publish_app.tests._flyingupload_factories import (
    fu_idea,  # noqa: F401
    fu_membership,  # noqa: F401
    fu_niche,  # noqa: F401
    fu_user,  # noqa: F401
    fu_workspace,  # noqa: F401
    make_design,
    make_global_listing,
    make_mba_listing,
    make_product_config,
    png_bytes,  # noqa: F401
)


def _decode_csv(blob: bytes) -> str:
    assert blob.startswith(b'\xef\xbb\xbf'), 'Missing UTF-8 BOM'
    return blob[3:].decode('utf-8')


class TestCSVExport:
    def test_utf8_bom_prefix(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-136: CSV output starts with UTF-8 BOM."""
        design = make_design(
            fu_workspace, fu_user, file_name='csv.png', png_bytes=png_bytes,
        )
        make_mba_listing(fu_workspace, fu_idea, design)
        make_global_listing(
            fu_workspace, fu_idea, design,
            keywords={'en': ['cat']},
        )
        make_product_config(design)
        blob, summary = build_mba_csv(
            str(fu_workspace.id), [str(design.id)],
        )
        assert blob[:3] == b'\xef\xbb\xbf'
        assert summary['ready_rows'] == 1

    def test_rfc4180_quoting(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-136: every cell double-quoted (quoting=csv.QUOTE_ALL)."""
        design = make_design(
            fu_workspace, fu_user, file_name='q.png', png_bytes=png_bytes,
        )
        make_mba_listing(
            fu_workspace, fu_idea, design,
            title='Already "quoted" title',
        )
        make_global_listing(fu_workspace, fu_idea, design)
        make_product_config(design)
        blob, _ = build_mba_csv(
            str(fu_workspace.id), [str(design.id)],
        )
        text = _decode_csv(blob)
        # Every line starts with " (BOM stripped already).
        for line in text.splitlines():
            if not line:
                continue
            assert line.startswith('"'), line
        # Embedded " is escaped as "".
        assert '""quoted""' in text

    def test_newlines_in_description_quoted(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """RFC 4180: newlines inside cells stay inside quotes."""
        design = make_design(
            fu_workspace, fu_user, file_name='nl.png', png_bytes=png_bytes,
        )
        make_mba_listing(
            fu_workspace, fu_idea, design,
            description='line1\nline2\nline3',
        )
        make_global_listing(fu_workspace, fu_idea, design)
        make_product_config(design)
        blob, _ = build_mba_csv(
            str(fu_workspace.id), [str(design.id)],
        )
        text = _decode_csv(blob)
        # The description cell has embedded newlines but the record is still
        # a single logical CSV row (header row + one data record).
        assert 'line1\nline2\nline3' in text

    def test_basic_csv_9_cols(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        design = make_design(
            fu_workspace, fu_user, file_name='b.png', png_bytes=png_bytes,
        )
        make_global_listing(
            fu_workspace, fu_idea, design,
            type_flags=['men'],
            color_mode='black',
            keywords={'en': ['a', 'b']},
        )
        blob, summary = build_basic_csv(
            str(fu_workspace.id), [str(design.id)],
        )
        assert summary['ready_rows'] == 1
        text = _decode_csv(blob)
        header = text.splitlines()[0]
        # Count quoted fields in the header line.
        assert header.count('","') == 8  # 9 columns => 8 separators

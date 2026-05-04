"""Phase S7: MBA XLSX export tests."""

from __future__ import annotations

import pytest

from publish_app.services.flyingupload_export import build_mba_bundle
from publish_app.tests._flyingupload_factories import (
    fu_idea,  # noqa: F401
    fu_membership,  # noqa: F401
    fu_niche,  # noqa: F401
    fu_user,  # noqa: F401
    fu_workspace,  # noqa: F401
    list_zip_entries,
    make_design,
    make_displate_listing,
    make_global_listing,
    make_mba_listing,
    make_product_config,
    png_bytes,  # noqa: F401
    read_xlsx_from_zip,
)


@pytest.fixture
def design(fu_workspace, fu_user, png_bytes):
    return make_design(
        fu_workspace, fu_user, file_name='cat.png', png_bytes=png_bytes,
    )


@pytest.fixture
def mba_listing(fu_workspace, fu_idea, design):
    return make_mba_listing(
        fu_workspace, fu_idea, design,
        translations={
            'en': {'title': 'EN Title', 'bullet_1': 'B1', 'bullet_2': 'B2'},
            'de': {'title': 'DE Title', 'description': 'DE Desc'},
            'ja': {'title': 'JP Title'},
        },
    )


@pytest.fixture
def global_listing(fu_workspace, fu_idea, design):
    return make_global_listing(
        fu_workspace, fu_idea, design,
        keywords={
            'en': ['cat', 'funny', 'tshirt'],
            'de': ['katze', 'lustig'],
            'ja': ['neko'],
        },
        type_flags=['men', 'women'],
        color_mode='black',
    )


@pytest.fixture
def product_config(design):
    return make_product_config(design)


@pytest.fixture
def export_bundle(
    fu_workspace,
    fu_membership,
    design,
    mba_listing,
    global_listing,
    product_config,
):
    zip_bytes, summary = build_mba_bundle(
        str(fu_workspace.id), [str(design.id)],
    )
    return zip_bytes, summary


class TestMBAExport:
    def test_sheet_name_and_headers(self, export_bundle):
        zip_bytes, _ = export_bundle
        wb = read_xlsx_from_zip(zip_bytes)
        assert 'Flying Upload POD' in wb.sheetnames
        ws = wb['Flying Upload POD']
        assert ws.cell(row=1, column=1).value == 'Image Path'
        assert ws.cell(row=1, column=3).value == 'Title DE'
        assert ws.cell(row=1, column=18).value == 'Title EN'
        assert ws.cell(row=1, column=21).value == 'Type'
        assert ws.cell(row=1, column=52).value == 'Product'
        assert ws.cell(row=1, column=66).value == 'Background Color (Hex)'

    def test_gap_columns_remain_empty(self, export_bundle):
        """B, W, BK are intentionally empty headers per AC-92."""
        zip_bytes, _ = export_bundle
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        # Row 2 = first data row.
        assert ws.cell(row=2, column=2).value in (None, '')  # B
        assert ws.cell(row=2, column=23).value in (None, '')  # W
        assert ws.cell(row=2, column=63).value in (None, '')  # BK

    def test_fan_out_one_row_per_enabled_product(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-94: one row per (design × enabled product)."""
        design = make_design(
            fu_workspace, fu_user, file_name='two.png', png_bytes=png_bytes,
        )
        make_mba_listing(fu_workspace, fu_idea, design)
        make_global_listing(fu_workspace, fu_idea, design)
        make_product_config(
            design,
            products_config=[
                {
                    'product_type': 't_shirt',
                    'enabled': True,
                    'fit_types': ['men'],
                    'print_side': 'front',
                    'colors': ['black'],
                    'marketplaces': [
                        {
                            'marketplace': 'amazon.com',
                            'price': '19.99',
                            'enabled': True,
                        },
                    ],
                },
                {
                    'product_type': 'hoodie_pullover',
                    'enabled': True,
                    'fit_types': ['men', 'women'],
                    'print_side': 'back',
                    'colors': ['black', 'white'],
                    'marketplaces': [
                        {
                            'marketplace': 'amazon.com',
                            'price': '34.99',
                            'enabled': True,
                        },
                    ],
                },
                {
                    'product_type': 'tank_top',
                    'enabled': False,
                    'fit_types': ['men'],
                    'print_side': 'front',
                    'colors': ['black'],
                    'marketplaces': [],
                },
            ],
        )
        zip_bytes, summary = build_mba_bundle(
            str(fu_workspace.id), [str(design.id)],
        )
        assert summary['ready_rows'] == 2
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        # 2 data rows.
        assert ws.cell(row=2, column=52).value == 'Standard t-shirt'
        assert ws.cell(row=3, column=52).value == 'Pullover Hoodie'
        # Row 4 should be empty.
        assert ws.cell(row=4, column=52).value in (None, '')

    def test_image_path_relative_to_designs(self, export_bundle):
        zip_bytes, summary = export_bundle
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        value = ws.cell(row=2, column=1).value
        assert value.startswith('designs/')
        # ZIP contains that path.
        names = list_zip_entries(zip_bytes)
        assert any(n == value for n in names)

    def test_brand_duplicated_to_all_6_language_columns(self, export_bundle):
        zip_bytes, _ = export_bundle
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        # X-AC = columns 24..29.
        for col in range(24, 30):
            assert ws.cell(row=2, column=col).value == 'CatBrand'

    def test_ja_language_maps_to_JP(self, export_bundle):
        """AC-93 note: our `ja` maps to Excel column `JP`."""
        zip_bytes, _ = export_bundle
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        # O = Title JP (col 15).
        assert ws.cell(row=1, column=15).value == 'Title JP'
        assert ws.cell(row=2, column=15).value == 'JP Title'
        # Tags JP (col 17) from global keywords.
        assert ws.cell(row=2, column=17).value == 'neko'

    def test_amazon_com_maps_to_US(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-93 BA column = enabled marketplace codes joined by CSV."""
        design = make_design(
            fu_workspace, fu_user, file_name='us.png', png_bytes=png_bytes,
        )
        make_mba_listing(fu_workspace, fu_idea, design)
        make_global_listing(fu_workspace, fu_idea, design)
        make_product_config(
            design,
            products_config=[
                {
                    'product_type': 't_shirt',
                    'enabled': True,
                    'fit_types': ['men'],
                    'print_side': 'front',
                    'colors': ['black'],
                    'marketplaces': [
                        {
                            'marketplace': 'amazon.com',
                            'price': '19.99',
                            'enabled': True,
                        },
                        {
                            'marketplace': 'amazon.co.uk',
                            'price': '19.99',
                            'enabled': True,
                        },
                        {
                            'marketplace': 'amazon.co.jp',
                            'price': '2580',
                            'enabled': False,
                        },
                    ],
                },
            ],
        )
        zip_bytes, _ = build_mba_bundle(
            str(fu_workspace.id), [str(design.id)],
        )
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        marketplace_csv = ws.cell(row=2, column=53).value  # BA
        assert marketplace_csv == 'US, UK'
        # BB (Price US) = 19.99; BH (Price JP) = empty.
        assert str(ws.cell(row=2, column=54).value).startswith('19.99')
        assert ws.cell(row=2, column=60).value in (None, '')

    def test_background_color_hex_from_displate_listing(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-127: MBA BN column reads displate listing's bg hex."""
        design = make_design(
            fu_workspace, fu_user, file_name='disp.png', png_bytes=png_bytes,
        )
        make_mba_listing(fu_workspace, fu_idea, design)
        make_global_listing(fu_workspace, fu_idea, design)
        make_product_config(design)
        make_displate_listing(
            fu_workspace, fu_idea, design,
            background_color_hex='#FF00AA',
        )
        zip_bytes, _ = build_mba_bundle(
            str(fu_workspace.id), [str(design.id)],
        )
        wb = read_xlsx_from_zip(zip_bytes)
        ws = wb['Flying Upload POD']
        assert ws.cell(row=2, column=66).value == '#FF00AA'

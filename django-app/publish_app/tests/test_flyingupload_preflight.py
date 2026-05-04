"""Phase S7: Preflight tests."""

from __future__ import annotations

from publish_app.services.flyingupload_export import preflight
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


class TestPreflight:
    def test_ready_rows_post_fan_out(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-91: ready_rows reflects the fan-out count (MBA)."""
        design = make_design(
            fu_workspace, fu_user, file_name='a.png', png_bytes=png_bytes,
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
                    'product_type': 'sweatshirt',
                    'enabled': True,
                    'fit_types': ['men'],
                    'print_side': 'front',
                    'colors': ['black'],
                    'marketplaces': [
                        {
                            'marketplace': 'amazon.com',
                            'price': '27.99',
                            'enabled': True,
                        },
                    ],
                },
            ],
        )
        summary = preflight(
            str(fu_workspace.id), [str(design.id)], template='mba',
        )
        assert summary['template'] == 'mba'
        assert summary['total_designs'] == 1
        assert summary['ready_rows'] == 2
        assert summary['skipped'] == []

    def test_no_listing_skip_reason(
        self, fu_workspace, fu_membership, fu_user, png_bytes,
    ):
        design = make_design(
            fu_workspace, fu_user, file_name='b.png', png_bytes=png_bytes,
        )
        summary = preflight(
            str(fu_workspace.id), [str(design.id)], template='mba',
        )
        assert summary['ready_rows'] == 0
        assert summary['skipped'][0]['reason'] == 'no_listing'

    def test_no_enabled_products_skip_reason(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        design = make_design(
            fu_workspace, fu_user, file_name='c.png', png_bytes=png_bytes,
        )
        make_mba_listing(fu_workspace, fu_idea, design)
        make_product_config(
            design,
            products_config=[
                {
                    'product_type': 't_shirt',
                    'enabled': False,
                    'fit_types': ['men'],
                    'print_side': 'front',
                    'colors': ['black'],
                    'marketplaces': [],
                },
            ],
        )
        summary = preflight(
            str(fu_workspace.id), [str(design.id)], template='mba',
        )
        assert summary['ready_rows'] == 0
        assert summary['skipped'][0]['reason'] == 'no_enabled_products'

    def test_image_unavailable_skip_reason(
        self, fu_workspace, fu_membership, fu_idea, fu_user, png_bytes,
    ):
        """AC-104: missing image binary -> image_unavailable."""
        design = make_design(
            fu_workspace, fu_user, file_name='d.png',
            png_bytes=png_bytes, with_file=False,
        )
        make_mba_listing(fu_workspace, fu_idea, design)
        make_product_config(design)
        summary = preflight(
            str(fu_workspace.id), [str(design.id)], template='mba',
        )
        assert summary['ready_rows'] == 0
        assert summary['skipped'][0]['reason'] == 'image_unavailable'

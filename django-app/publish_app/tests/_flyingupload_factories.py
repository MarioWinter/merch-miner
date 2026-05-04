"""Shared fixtures for FlyingUpload export tests (PROJ-11 Phase S)."""

from __future__ import annotations

import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import (
    DesignAsset,
    DesignProductConfig,
    Listing,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


# A tiny 1x1 PNG blob (actual PNG bytes so ZIP packaging works).
_PNG_1x1 = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8'
    b'\xff\xff?\x00\x05\xfe\x02\xfe\xa75\x81\x84\x00\x00\x00\x00IEND\xaeB`\x82'
)


@pytest.fixture
def png_bytes() -> bytes:
    return _PNG_1x1


@pytest.fixture
def fu_user(db):
    return User.objects.create_user(
        email='fu@example.com', password='testpass123',
    )


@pytest.fixture
def fu_workspace(fu_user):
    return Workspace.objects.create(
        name='FU WS', slug='fu-ws', owner=fu_user,
    )


@pytest.fixture
def fu_membership(fu_workspace, fu_user):
    return Membership.objects.create(
        workspace=fu_workspace,
        user=fu_user,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def fu_niche(fu_workspace, fu_user):
    return Niche.objects.create(
        workspace=fu_workspace, name='FU Niche', created_by=fu_user,
    )


@pytest.fixture
def fu_idea(fu_workspace, fu_niche, fu_user):
    return Idea.objects.create(
        workspace=fu_workspace, niche=fu_niche,
        slogan_text='Funny Cat Saying', created_by=fu_user,
    )


def make_design(
    workspace,
    user,
    file_name='cat_design.png',
    png_bytes=_PNG_1x1,
    with_file=True,
) -> DesignAsset:
    asset = DesignAsset(
        workspace=workspace,
        file_name=file_name,
        source=DesignAsset.Source.UPLOAD,
        created_by=user,
        file_size=len(png_bytes),
    )
    if with_file:
        asset.file.save(file_name, ContentFile(png_bytes), save=False)
    asset.save()
    return asset


def make_mba_listing(
    workspace,
    idea,
    design,
    *,
    title='Funny Cat T-Shirt',
    description='A hilarious cat design with extra details',
    brand_name='CatBrand',
    translations=None,
    bullet_1='Super soft cotton',
    bullet_2='Great gift idea',
    category='',
    publish_mode=Listing.PublishMode.LIVE,
) -> Listing:
    return Listing.objects.create(
        workspace=workspace,
        idea=idea,
        design=design,
        marketplace_type=Listing.MarketplaceType.MBA,
        title=title,
        description=description,
        brand_name=brand_name,
        bullet_1=bullet_1,
        bullet_2=bullet_2,
        translations=translations or {},
        category=category,
        publish_mode=publish_mode,
    )


def make_global_listing(
    workspace,
    idea,
    design,
    *,
    title='Global Cat Title',
    description='Global cat description',
    translations=None,
    keywords=None,
    type_flags=None,
    color_mode='',
) -> Listing:
    return Listing.objects.create(
        workspace=workspace,
        idea=idea,
        design=design,
        marketplace_type=Listing.MarketplaceType.GLOBAL,
        title=title,
        description=description,
        translations=translations or {},
        keywords=keywords or {},
        type_flags=type_flags or [],
        color_mode=color_mode,
    )


def make_displate_listing(
    workspace,
    idea,
    design,
    *,
    background_color_hex='#FF00AA',
) -> Listing:
    return Listing.objects.create(
        workspace=workspace,
        idea=idea,
        design=design,
        marketplace_type=Listing.MarketplaceType.DISPLATE,
        title='Displate Cat Title',
        background_color_hex=background_color_hex,
    )


def make_product_config(
    design,
    *,
    products_config=None,
) -> DesignProductConfig:
    if products_config is None:
        products_config = [
            {
                'product_type': 't_shirt',
                'enabled': True,
                'fit_types': ['men', 'women'],
                'print_side': 'front',
                'colors': ['black', 'navy'],
                'marketplaces': [
                    {
                        'marketplace': 'amazon.com',
                        'price': '19.99',
                        'enabled': True,
                    },
                    {
                        'marketplace': 'amazon.de',
                        'price': '18.99',
                        'enabled': True,
                    },
                    {
                        'marketplace': 'amazon.co.jp',
                        'price': '2580',
                        'enabled': False,
                    },
                ],
            },
        ]
    return DesignProductConfig.objects.create(
        design=design,
        marketplace_type=DesignProductConfig.MarketplaceType.MBA,
        products_config=products_config,
    )


# Expose helpers for direct import from tests.
_PNG = _PNG_1x1


def read_xlsx_from_zip(zip_bytes: bytes):
    """Helper: read the inner XLSX as an openpyxl workbook."""
    import zipfile

    import openpyxl

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = [n for n in zf.namelist() if n.endswith('.xlsx')]
        assert names, f'No XLSX in ZIP: {zf.namelist()}'
        with zf.open(names[0]) as fh:
            return openpyxl.load_workbook(io.BytesIO(fh.read()))


def list_zip_entries(zip_bytes: bytes) -> list[str]:
    import zipfile

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        return zf.namelist()

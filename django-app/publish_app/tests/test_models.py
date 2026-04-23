"""Tests for publish_app models."""

import pytest
from django.contrib.auth import get_user_model

from niche_app.models import Niche
from idea_app.models import Idea
from publish_app.models import (
    DesignAsset,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)
from workspace_app.models import Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='test@example.com', password='testpass123')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Test Niche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Test Slogan', created_by=user,
    )


@pytest.fixture
def design_asset(workspace, user):
    return DesignAsset.objects.create(
        workspace=workspace, file_name='test.png',
        source=DesignAsset.Source.UPLOAD, created_by=user,
    )


@pytest.fixture
def listing(workspace, idea, design_asset):
    return Listing.objects.create(
        workspace=workspace, idea=idea, design=design_asset,
        brand_name='TestBrand', title='Test Title',
        bullet_1='Bullet 1', description='Description',
    )


class TestListingModel:
    def test_create_listing(self, listing):
        assert listing.status == Listing.Status.DRAFT
        assert listing.generated_by == Listing.GeneratedBy.MANUAL
        assert listing.availability == Listing.Availability.PUBLIC
        assert listing.publish_mode == Listing.PublishMode.LIVE

    def test_listing_str(self, listing):
        assert str(listing.id)[:8] in str(listing)

    def test_listing_defaults(self, workspace, idea):
        listing = Listing.objects.create(workspace=workspace, idea=idea)
        assert listing.language == 'en'
        assert listing.round == 1
        assert listing.translations == {}


class TestUploadTemplateModel:
    def test_create_template(self, workspace, user):
        products_config = [
            {
                'product_type': 'standard_tshirt',
                'enabled': True,
                'fit_types': ['men', 'women'],
                'print_side': 'front',
                'colors': ['black', 'white'],
                'marketplaces': [
                    {
                        'marketplace': 'amazon.com',
                        'price': '19.99',
                        'enabled': True,
                    },
                ],
            },
            {
                'product_type': 'hoodie',
                'enabled': True,
                'fit_types': ['men', 'women'],
                'print_side': 'front',
                'colors': ['black', 'white'],
                'marketplaces': [
                    {
                        'marketplace': 'amazon.com',
                        'price': '29.99',
                        'enabled': True,
                    },
                ],
            },
        ]
        t = UploadTemplate.objects.create(
            workspace=workspace, name='Default', created_by=user,
            products_config=products_config,
        )
        assert len(t.products_config) == 2
        assert t.products_config[0]['product_type'] == 'standard_tshirt'
        assert t.products_config[1]['product_type'] == 'hoodie'

    def test_template_str(self, workspace, user):
        t = UploadTemplate.objects.create(
            workspace=workspace, name='My Template', created_by=user,
        )
        assert 'My Template' in str(t)

    def test_template_empty_products_config_default(self, workspace, user):
        t = UploadTemplate.objects.create(
            workspace=workspace, name='Empty', created_by=user,
        )
        assert t.products_config == []


class TestUploadJobModel:
    def test_create_job(self, workspace, listing, design_asset, user):
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing, design=design_asset,
            marketplace='amazon.com', created_by=user,
            listing_snapshot={'title': 'Test'},
        )
        assert job.status == UploadJob.Status.PENDING
        assert job.retry_count == 0

    def test_job_str(self, workspace, listing, user):
        job = UploadJob.objects.create(
            workspace=workspace, listing=listing,
            marketplace='amazon.de', created_by=user,
        )
        assert 'amazon.de' in str(job)


class TestDesignAssetModel:
    def test_create_asset(self, design_asset):
        assert design_asset.source == DesignAsset.Source.UPLOAD
        assert design_asset.file_size == 0
        assert design_asset.tags == []

    def test_asset_constants(self):
        assert DesignAsset.MAX_FILE_SIZE == 25 * 1024 * 1024
        assert 'image/png' in DesignAsset.ALLOWED_TYPES


class TestProductLifecycleModel:
    def test_create_lifecycle(self, workspace, niche, idea, design_asset, listing):
        lc = ProductLifecycle.objects.create(
            workspace=workspace, niche=niche, idea=idea,
            design=design_asset, listing=listing,
            asin='B0TEST123', marketplace='amazon.com',
        )
        assert lc.round == 1
        assert lc.asin == 'B0TEST123'

    def test_lifecycle_str(self, workspace, niche):
        lc = ProductLifecycle.objects.create(
            workspace=workspace, niche=niche,
        )
        assert 'no ASIN' in str(lc)

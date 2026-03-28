import pytest
from django.contrib.contenttypes.models import ContentType

from vector_app.models import Embedding


@pytest.fixture
def workspace(db):
    from workspace_app.models import Workspace
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_user(email='owner@test.com', password='testpass123')
    return Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)


@pytest.fixture
def niche(db, workspace):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.first()
    from niche_app.models import Niche
    return Niche.objects.create(
        name='Camping Dad',
        notes='Funny camping shirts for dads',
        workspace=workspace,
        created_by=user,
    )


@pytest.mark.django_db
class TestEmbeddingModel:
    def test_create_embedding(self, workspace, niche):
        ct = ContentType.objects.get_for_model(niche)
        emb = Embedding.objects.create(
            content_type=ct,
            object_id=niche.pk,
            workspace=workspace,
            embedding=[0.1] * 1536,
            text_input='Camping Dad Funny camping shirts for dads',
            search_text='Camping Dad Funny camping shirts for dads',
            metadata={'source_type': 'niche'},
        )
        assert emb.pk is not None
        assert emb.workspace == workspace
        assert emb.content_type == ct
        assert str(emb.object_id) == str(niche.pk)

    def test_unique_together_constraint(self, workspace, niche):
        ct = ContentType.objects.get_for_model(niche)
        Embedding.objects.create(
            content_type=ct,
            object_id=niche.pk,
            workspace=workspace,
            embedding=[0.1] * 1536,
            text_input='test',
            search_text='test',
        )
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            Embedding.objects.create(
                content_type=ct,
                object_id=niche.pk,
                workspace=workspace,
                embedding=[0.2] * 1536,
                text_input='test2',
                search_text='test2',
            )

    def test_cascade_on_workspace_delete(self, workspace, niche):
        ct = ContentType.objects.get_for_model(niche)
        Embedding.objects.create(
            content_type=ct,
            object_id=niche.pk,
            workspace=workspace,
            embedding=[0.1] * 1536,
            text_input='test',
            search_text='test',
        )
        assert Embedding.objects.count() == 1
        workspace.delete()
        assert Embedding.objects.count() == 0

    def test_str_representation(self, workspace, niche):
        ct = ContentType.objects.get_for_model(niche)
        emb = Embedding.objects.create(
            content_type=ct,
            object_id=niche.pk,
            workspace=workspace,
            embedding=[0.1] * 1536,
            text_input='test',
            search_text='test',
        )
        assert 'Embedding' in str(emb)
        assert str(niche.pk) in str(emb)


@pytest.mark.django_db
class TestGetEmbeddingText:
    def test_niche_embedding_text(self, niche):
        text = niche.get_embedding_text()
        assert 'Camping Dad' in text
        assert 'Funny camping shirts' in text

    def test_niche_empty_notes(self, workspace):
        from django.contrib.auth import get_user_model
        from niche_app.models import Niche
        User = get_user_model()
        user = User.objects.first()
        niche = Niche.objects.create(
            name='Test Niche',
            workspace=workspace,
            created_by=user,
        )
        text = niche.get_embedding_text()
        assert text == 'Test Niche'

    def test_amazon_product_embedding_text(self, db):
        from scraper_app.models import AmazonProduct
        product = AmazonProduct.objects.create(
            asin='B0TEST123',
            marketplace='amazon_com',
            title='Funny Camping Shirt',
            brand='CampBrand',
            bullet_1='100% Cotton',
            bullet_2='Machine washable',
        )
        text = product.get_embedding_text()
        assert 'Funny Camping Shirt' in text
        assert 'CampBrand' in text
        assert '100% Cotton' in text

"""Tests for keyword_app models."""

import pytest
from django.db import IntegrityError
from django.utils import timezone

from keyword_app.models import (
    KeywordJSCache,
    NicheKeyword,
    NicheKeywordGroup,
    NicheJSCallTracker,
    JSUsageLog,
)


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(
        email='testuser@test.com', password='testpass123',
    )


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace, Membership
    ws = Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )
    return ws


@pytest.fixture
def niche(db, workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=workspace, name='Camping Dad', created_by=user,
    )


class TestNicheKeyword:
    def test_create_keyword(self, niche, user):
        kw = NicheKeyword.objects.create(
            niche=niche, keyword='camping humor', source='manual', created_by=user,
        )
        assert str(kw) == f'camping humor ({niche})'

    def test_unique_constraint(self, niche, user):
        NicheKeyword.objects.create(
            niche=niche, keyword='camping', source='manual', created_by=user,
        )
        with pytest.raises(IntegrityError):
            NicheKeyword.objects.create(
                niche=niche, keyword='camping', source='research', created_by=user,
            )

    def test_cascade_on_niche_delete(self, niche, user):
        NicheKeyword.objects.create(
            niche=niche, keyword='test', source='manual', created_by=user,
        )
        niche.delete()
        assert NicheKeyword.objects.count() == 0


class TestNicheKeywordGroup:
    def test_create_group(self, niche, user):
        group = NicheKeywordGroup.objects.create(
            niche=niche, name='Primary', position=0, created_by=user,
        )
        assert str(group) == f'Primary ({niche})'

    def test_unique_name_per_niche(self, niche, user):
        NicheKeywordGroup.objects.create(
            niche=niche, name='Primary', position=0, created_by=user,
        )
        with pytest.raises(IntegrityError):
            NicheKeywordGroup.objects.create(
                niche=niche, name='Primary', position=1, created_by=user,
            )

    def test_delete_group_ungrouped(self, niche, user):
        """When group is deleted, keywords become ungrouped (not deleted)."""
        group = NicheKeywordGroup.objects.create(
            niche=niche, name='Primary', position=0, created_by=user,
        )
        kw = NicheKeyword.objects.create(
            niche=niche, keyword='test', source='manual',
            group=group, created_by=user,
        )
        group.delete()
        kw.refresh_from_db()
        assert kw.group is None


class TestKeywordJSCache:
    def test_create_cache_entry(self, db):
        entry = KeywordJSCache.objects.create(
            keyword='camping shirts',
            marketplace='amazon_com',
            monthly_search_volume_exact=5000,
            ease_of_ranking_score=7,
            fetched_at=timezone.now(),
        )
        assert entry.monthly_search_volume_exact == 5000

    def test_unique_keyword_marketplace(self, db):
        KeywordJSCache.objects.create(
            keyword='camping', marketplace='amazon_com',
            fetched_at=timezone.now(),
        )
        with pytest.raises(IntegrityError):
            KeywordJSCache.objects.create(
                keyword='camping', marketplace='amazon_com',
                fetched_at=timezone.now(),
            )


class TestNicheJSCallTracker:
    def test_one_per_niche(self, niche):
        NicheJSCallTracker.objects.create(niche=niche, keyword_used='camping')
        with pytest.raises(IntegrityError):
            NicheJSCallTracker.objects.create(niche=niche, keyword_used='other')


class TestJSUsageLog:
    def test_create_log(self, db, user):
        log = JSUsageLog.objects.create(
            provider='junglescout',
            endpoint='keywords_by_keyword',
            keywords_count=10,
            user=user,
        )
        assert str(log) == 'junglescout keywords_by_keyword (10 kw)'

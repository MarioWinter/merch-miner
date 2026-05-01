"""Tests for CanaryAsin & SelectorHealthCheck admin (PROJ-23)."""

from unittest.mock import MagicMock, patch

import pytest
from django.urls import reverse

from scraper_app.models import CanaryAsin, SelectorHealthCheck


pytestmark = pytest.mark.django_db


@pytest.fixture
def canary():
    return CanaryAsin.objects.create(
        asin='B077GRS3BJ',
        marketplace='amazon_com',
        label='Test Canary',
        active=True,
    )


# ---------------------------------------------------------------------------
# Admin action enqueues RQ job
# ---------------------------------------------------------------------------

def test_admin_action_enqueues_health_check(admin_client, canary):
    """`Run health check now` action posts to the changelist and enqueues onto scraper queue."""
    url = reverse('admin:scraper_app_canaryasin_changelist')

    fake_queue = MagicMock()
    fake_job = MagicMock()
    fake_job.id = 'rq-job-123'
    fake_queue.enqueue.return_value = fake_job

    with patch('django_rq.get_queue', return_value=fake_queue):
        response = admin_client.post(url, {
            'action': 'run_health_check_now',
            '_selected_action': [str(canary.id)],
        }, follow=True)

    assert response.status_code == 200
    fake_queue.enqueue.assert_called_once()
    args, kwargs = fake_queue.enqueue.call_args
    assert kwargs['canary_id'] == str(canary.id)
    assert kwargs['triggered_by'] == 'admin'


def test_admin_action_handles_multiple_canaries(admin_client):
    """Multi-row selection enqueues one job per canary."""
    c1 = CanaryAsin.objects.create(asin='AAAAAAAAAA', marketplace='amazon_com', label='c1')
    c2 = CanaryAsin.objects.create(asin='BBBBBBBBBB', marketplace='amazon_de', label='c2')

    fake_queue = MagicMock()
    fake_queue.enqueue.return_value = MagicMock(id='x')
    with patch('django_rq.get_queue', return_value=fake_queue):
        admin_client.post(
            reverse('admin:scraper_app_canaryasin_changelist'),
            {
                'action': 'run_health_check_now',
                '_selected_action': [str(c1.id), str(c2.id)],
            },
            follow=True,
        )
    assert fake_queue.enqueue.call_count == 2


# ---------------------------------------------------------------------------
# CanaryAsin admin renders
# ---------------------------------------------------------------------------

def test_canary_changelist_renders(admin_client, canary):
    response = admin_client.get(reverse('admin:scraper_app_canaryasin_changelist'))
    assert response.status_code == 200
    assert b'B077GRS3BJ' in response.content


def test_canary_changelist_shows_never_run_when_no_checks(admin_client, canary):
    response = admin_client.get(reverse('admin:scraper_app_canaryasin_changelist'))
    assert b'never run' in response.content


def test_canary_changelist_shows_pass_badge(admin_client, canary):
    SelectorHealthCheck.objects.create(
        canary=canary, passed=True, results={'title': 'OK'},
    )
    response = admin_client.get(reverse('admin:scraper_app_canaryasin_changelist'))
    assert b'PASS' in response.content


def test_canary_changelist_shows_fail_badge(admin_client, canary):
    SelectorHealthCheck.objects.create(
        canary=canary, passed=False, results={'title': 'EMPTY'},
    )
    response = admin_client.get(reverse('admin:scraper_app_canaryasin_changelist'))
    assert b'FAIL' in response.content


# ---------------------------------------------------------------------------
# SelectorHealthCheck admin
# ---------------------------------------------------------------------------

def test_health_check_list_renders(admin_client, canary):
    SelectorHealthCheck.objects.create(
        canary=canary, passed=True, results={'title': 'OK'},
        triggered_by='admin', html_size_bytes=1024 * 50,
    )
    response = admin_client.get(reverse('admin:scraper_app_selectorhealthcheck_changelist'))
    assert response.status_code == 200
    assert b'PASS' in response.content


def test_health_check_failed_field_count_in_admin(admin_client, canary):
    """The failed_field_count column should reflect EMPTY entries."""
    SelectorHealthCheck.objects.create(
        canary=canary,
        passed=False,
        results={'title': 'OK', 'bsr': 'EMPTY', 'description': 'EMPTY'},
        triggered_by='schedule',
    )
    response = admin_client.get(reverse('admin:scraper_app_selectorhealthcheck_changelist'))
    assert response.status_code == 200
    # 2 EMPTY entries should be rendered somewhere on the page.
    assert b'>2<' in response.content or b'2 EMPTY' in response.content or b'>2 ' in response.content


def test_health_check_admin_blocks_manual_creation(admin_client):
    """Manual `Add` should be disabled — health checks are produced by the system."""
    response = admin_client.get(reverse('admin:scraper_app_selectorhealthcheck_add'))
    # Admin returns 403 when has_add_permission returns False.
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Model-level integrity
# ---------------------------------------------------------------------------

def test_canary_unique_together_asin_marketplace(canary):
    """Cannot create a second canary with the same (asin, marketplace) pair."""
    from django.db import IntegrityError
    with pytest.raises(IntegrityError):
        CanaryAsin.objects.create(
            asin='B077GRS3BJ', marketplace='amazon_com', label='dup',
        )


def test_canary_asin_uppercase_normalisation():
    """ASIN should be uppercased + stripped on save."""
    c = CanaryAsin.objects.create(
        asin='  b077grs3bj  ', marketplace='amazon_com', label='lower',
    )
    c.refresh_from_db()
    assert c.asin == 'B077GRS3BJ'


def test_failed_field_count_computed_property(canary):
    hc = SelectorHealthCheck.objects.create(
        canary=canary,
        results={'title': 'OK', 'bsr': 'EMPTY', 'brand': 'EMPTY', 'price': 'INFO'},
        passed=False,
    )
    assert hc.failed_field_count == 2

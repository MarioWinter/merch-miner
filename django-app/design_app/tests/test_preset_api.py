"""PROJ-34 Phase 13t-g — NicheCardPresetViewSet integration tests.

Covers the 7 endpoints exposed by ``design_app.api.views.NicheCardPresetViewSet``:
  GET    /api/designs/preset-cards/?niche_id=<uuid>     — list (Vorschläge)
  GET    /api/designs/preset-cards/history/             — history (workspace, ≤50)
  GET    /api/designs/preset-cards/custom/              — custom (workspace, uncapped)
  POST   /api/designs/preset-cards/confirm/             — confirm (id OR dict)
  POST   /api/designs/preset-cards/<id>/promote-custom/ — promote
  DELETE /api/designs/preset-cards/<id>/custom/         — unpromote
  POST   /api/designs/preset-cards/regenerate-mix/      — force LLM regen (throttled 5/h)
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from design_app.models import NicheCardPreset


pytestmark = pytest.mark.django_db


# ─── Fixtures ─────────────────────────────────────────────────────────────


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='preset-api@example.com', password='pw',
    )


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(
        email='preset-api-other@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Preset WS', slug='preset-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(other_user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(
        name='Other Preset WS', slug='other-preset-ws', owner=other_user,
    )
    Membership.objects.create(
        workspace=ws, user=other_user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def niche(workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=workspace,
        name='Test Niche',
        created_by=user,
    )


@pytest.fixture
def other_niche(other_workspace, other_user):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=other_workspace,
        name='Other Niche',
        created_by=other_user,
    )


@pytest.fixture
def auth_client(user, workspace):
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return c


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def _make_preset_dict(spatial_text: str = 'Centered Layout'):
    """Build a valid 17-key preset_dict for upsert_preset / confirm endpoint."""
    return {
        'slot_spatial_configuration': spatial_text,
        'slot_visual_description': 'a stylized eagle in 3/4 view with golden feathers',
        'slot_typography_adjectives': 'bold compressed stencil',
        'slot_font_combination': 'serif headline + sans tagline',
        'slot_accessories': 'sunburst rays radiating outward from behind the illustration',
        'slot_style_dna': 'vintage military propaganda poster aesthetic',
        'slot_extra_context': '',
        'spatial_is_raw': True,
        'visual_is_raw': True,
        'typography_is_raw': True,
        'font_combination_is_raw': True,
        'accessories_is_raw': False,
        'style_dna_is_raw': True,
        'extra_context_is_raw': True,
        'reference_thumbnail_url': 'https://example.com/thumb.jpg',
        'preset_label': 'Eagle Stencil',
    }


def _create_preset(workspace, **overrides) -> NicheCardPreset:
    """Create a NicheCardPreset row directly via .objects.create with sane defaults."""
    defaults = dict(
        workspace=workspace,
        preset_hash=overrides.pop('preset_hash', uuid.uuid4().hex + uuid.uuid4().hex)[:64],
        preset_label='Test Preset',
        slot_spatial_configuration='vertical_stack',
        slot_visual_description='test visual',
        slot_typography_adjectives='bold',
        slot_font_combination='serif',
        slot_accessories='',
        slot_style_dna='test dna',
        slot_extra_context='',
        spatial_is_raw=False,
        visual_is_raw=True,
        typography_is_raw=True,
        font_combination_is_raw=True,
        accessories_is_raw=True,
        style_dna_is_raw=True,
        extra_context_is_raw=True,
        reference_thumbnail_url='https://example.com/x.jpg',
        source_card_type='top',
        source_card_references=[{'niche_id': str(uuid.uuid4()), 'product_ids': [str(uuid.uuid4())]}],
        is_in_history=True,
        is_in_custom=False,
    )
    defaults.update(overrides)
    return NicheCardPreset.objects.create(**defaults)


# ─── list (Vorschläge) ────────────────────────────────────────────────────


def test_list_returns_vorschlaege_structure_with_cached_mixes(auth_client, niche):
    """Pre-populated best_of_mix_cache → returns mixes with 200."""
    niche.best_of_mix_cache = {
        'most_common': {'slot_spatial_configuration': 'badge', 'visual_is_raw': True},
        'edgy': {'slot_spatial_configuration': 'sunburst', 'visual_is_raw': True},
        'safe': {'slot_spatial_configuration': 'stack', 'visual_is_raw': True},
        'top3_product_ids': [str(uuid.uuid4()) for _ in range(3)],
        '_generated_at': timezone.now().isoformat(),
        '_source_research_id': str(uuid.uuid4()),
    }
    niche.save(update_fields=['best_of_mix_cache'])

    r = auth_client.get(f'/api/designs/preset-cards/?niche_id={niche.id}')
    assert r.status_code == 200
    body = r.json()
    assert 'top' in body
    assert 'collection' in body  # Phase 13t-s
    assert isinstance(body['collection'], list)
    assert 'best_of_mix' in body
    assert 'top3_product_ids' in body
    assert body['best_of_mix']['most_common'] is not None
    assert body['best_of_mix']['edgy'] is not None
    assert body['best_of_mix']['safe'] is not None
    # Mix payload should be augmented with collage url + card type + refs
    assert body['best_of_mix']['most_common']['source_card_type'] == 'mix_most_common'
    assert body['best_of_mix']['most_common']['reference_thumbnail_url'] == (
        f'/api/designs/preset-cards/collage/{niche.id}.webp'
    )


def test_list_returns_202_when_mixes_empty(auth_client, niche):
    """Cache-miss → enqueue async generation + 202 with null mix variants."""
    assert niche.best_of_mix_cache == {}

    with patch('design_app.api.views.django_rq.enqueue') as mock_enqueue:
        r = auth_client.get(f'/api/designs/preset-cards/?niche_id={niche.id}')

    assert r.status_code == 202
    body = r.json()
    assert body['best_of_mix']['most_common'] is None
    assert body['best_of_mix']['edgy'] is None
    assert body['best_of_mix']['safe'] is None
    mock_enqueue.assert_called_once()


def test_list_requires_niche_id(auth_client):
    """Missing niche_id query param → 400."""
    r = auth_client.get('/api/designs/preset-cards/')
    assert r.status_code == 400


def test_list_workspace_isolation(auth_client, other_niche):
    """User from workspace A querying niche from workspace B → 404."""
    r = auth_client.get(f'/api/designs/preset-cards/?niche_id={other_niche.id}')
    assert r.status_code == 404


# ─── history ──────────────────────────────────────────────────────────────


def test_history_returns_workspace_history_only(auth_client, workspace, other_workspace):
    _create_preset(workspace, preset_label='A1', is_in_history=True)
    _create_preset(workspace, preset_label='A2', is_in_history=True)
    _create_preset(other_workspace, preset_label='B1', is_in_history=True)

    r = auth_client.get('/api/designs/preset-cards/history/')
    assert r.status_code == 200
    labels = [row['preset_label'] for row in r.json()]
    assert sorted(labels) == ['A1', 'A2']


def test_history_orders_by_last_clicked_desc(auth_client, workspace):
    now = timezone.now()
    _create_preset(
        workspace, preset_label='OLD',
        last_clicked_at=now - timedelta(hours=2),
    )
    _create_preset(
        workspace, preset_label='NEW',
        last_clicked_at=now - timedelta(minutes=5),
    )
    r = auth_client.get('/api/designs/preset-cards/history/')
    assert r.status_code == 200
    labels = [row['preset_label'] for row in r.json()]
    assert labels[0] == 'NEW'
    assert labels[1] == 'OLD'


# ─── custom ───────────────────────────────────────────────────────────────


def test_custom_returns_workspace_custom_only(
    auth_client, workspace, other_workspace, user, other_user,
):
    _create_preset(
        workspace, preset_label='Mine',
        is_in_custom=True,
        custom_promoted_by=user,
        custom_promoted_at=timezone.now(),
    )
    _create_preset(
        workspace, preset_label='AlsoMine',
        is_in_custom=False,  # not custom — excluded
    )
    _create_preset(
        other_workspace, preset_label='Theirs',
        is_in_custom=True,
        custom_promoted_by=other_user,
        custom_promoted_at=timezone.now(),
    )
    r = auth_client.get('/api/designs/preset-cards/custom/')
    assert r.status_code == 200
    labels = [row['preset_label'] for row in r.json()]
    assert labels == ['Mine']


# ─── confirm ──────────────────────────────────────────────────────────────


def test_confirm_with_preset_id_bumps_last_clicked_at(auth_client, workspace):
    old_time = timezone.now() - timedelta(hours=3)
    preset = _create_preset(workspace, last_clicked_at=old_time)

    r = auth_client.post(
        '/api/designs/preset-cards/confirm/',
        {'preset_id': str(preset.id)},
        format='json',
    )
    assert r.status_code == 200
    preset.refresh_from_db()
    assert preset.last_clicked_at > old_time


def test_confirm_with_preset_dict_creates_row(auth_client, workspace, niche):
    payload = {
        'preset_dict': _make_preset_dict(),
        'source_card_type': 'top',
        'source_refs': [{'niche_id': str(niche.id), 'product_ids': [str(uuid.uuid4())]}],
    }
    assert NicheCardPreset.objects.filter(workspace=workspace).count() == 0

    r = auth_client.post('/api/designs/preset-cards/confirm/', payload, format='json')
    assert r.status_code == 200
    assert NicheCardPreset.objects.filter(workspace=workspace).count() == 1


def test_confirm_validates_payload_either_form(auth_client):
    """Empty body → 400. Both forms together → 400."""
    r = auth_client.post('/api/designs/preset-cards/confirm/', {}, format='json')
    assert r.status_code == 400

    payload = {
        'preset_id': str(uuid.uuid4()),
        'preset_dict': _make_preset_dict(),
        'source_card_type': 'top',
        'source_refs': [{'niche_id': str(uuid.uuid4()), 'product_ids': []}],
    }
    r = auth_client.post('/api/designs/preset-cards/confirm/', payload, format='json')
    assert r.status_code == 400


def test_confirm_404_when_preset_id_not_in_workspace(auth_client, other_workspace):
    foreign = _create_preset(other_workspace)
    r = auth_client.post(
        '/api/designs/preset-cards/confirm/',
        {'preset_id': str(foreign.id)},
        format='json',
    )
    assert r.status_code == 404


# ─── promote-custom ───────────────────────────────────────────────────────


def test_promote_custom_flips_flag(auth_client, workspace):
    preset = _create_preset(workspace, is_in_custom=False)
    r = auth_client.post(f'/api/designs/preset-cards/{preset.id}/promote-custom/')
    assert r.status_code == 200
    preset.refresh_from_db()
    assert preset.is_in_custom is True
    assert preset.custom_promoted_by_id is not None
    assert preset.custom_promoted_at is not None


def test_promote_custom_404_when_missing(auth_client):
    r = auth_client.post(f'/api/designs/preset-cards/{uuid.uuid4()}/promote-custom/')
    assert r.status_code == 404


def test_promote_custom_404_cross_workspace(auth_client, other_workspace):
    foreign = _create_preset(other_workspace)
    r = auth_client.post(f'/api/designs/preset-cards/{foreign.id}/promote-custom/')
    assert r.status_code == 404


# ─── custom-remove (unpromote) ────────────────────────────────────────────


def test_custom_remove_204_when_survives_in_history(auth_client, workspace, user):
    preset = _create_preset(
        workspace, is_in_history=True, is_in_custom=True,
        custom_promoted_by=user, custom_promoted_at=timezone.now(),
    )
    r = auth_client.delete(f'/api/designs/preset-cards/{preset.id}/custom/')
    assert r.status_code == 204
    preset.refresh_from_db()
    assert preset.is_in_custom is False
    assert preset.is_in_history is True  # survived


def test_custom_remove_204_when_hard_deletes_orphan(auth_client, workspace, user):
    preset = _create_preset(
        workspace, is_in_history=False, is_in_custom=True,
        custom_promoted_by=user, custom_promoted_at=timezone.now(),
    )
    r = auth_client.delete(f'/api/designs/preset-cards/{preset.id}/custom/')
    assert r.status_code == 204
    assert not NicheCardPreset.objects.filter(id=preset.id).exists()


# ─── regenerate-mix ───────────────────────────────────────────────────────


def test_regenerate_mix_calls_generator_force_true(auth_client, niche, workspace):
    fake_cache_payload = {
        'most_common': {**_make_preset_dict('badge'), 'preset_label': 'Most-Common Mix'},
        'edgy': {**_make_preset_dict('sunburst'), 'preset_label': 'Edgy Mix'},
        'safe': {**_make_preset_dict('vertical'), 'preset_label': 'Safe Mix'},
        'top3_product_ids': [str(uuid.uuid4()) for _ in range(3)],
        '_generated_at': timezone.now().isoformat(),
        '_source_research_id': str(uuid.uuid4()),
    }

    with patch(
        'design_app.services.best_of_mix_generator.generate_best_of_mix',
        return_value=fake_cache_payload,
    ) as mock_gen:
        r = auth_client.post(
            '/api/designs/preset-cards/regenerate-mix/',
            {'niche_id': str(niche.id)},
            format='json',
        )

    assert r.status_code == 200
    mock_gen.assert_called_once()
    _, kwargs = mock_gen.call_args
    assert kwargs.get('force') is True
    # AC-90: all 3 variants persisted to History
    assert NicheCardPreset.objects.filter(
        workspace=workspace, source_card_type__startswith='mix_',
    ).count() == 3


def test_regenerate_mix_502_on_generator_failure(auth_client, niche):
    with patch(
        'design_app.services.best_of_mix_generator.generate_best_of_mix',
        return_value=None,
    ):
        r = auth_client.post(
            '/api/designs/preset-cards/regenerate-mix/',
            {'niche_id': str(niche.id)},
            format='json',
        )
    assert r.status_code == 502


def test_regenerate_mix_404_cross_workspace(auth_client, other_niche):
    r = auth_client.post(
        '/api/designs/preset-cards/regenerate-mix/',
        {'niche_id': str(other_niche.id)},
        format='json',
    )
    assert r.status_code == 404


def test_regenerate_mix_throttled_at_third_request(auth_client, niche):
    """Override ScopedRateThrottle rate to 2/hour and assert 3rd call hits 429.

    DRF caches throttle rates as a class attribute; patch THROTTLE_RATES directly.
    """
    from rest_framework.throttling import ScopedRateThrottle

    fake_cache_payload = {
        'most_common': {**_make_preset_dict('a')},
        'edgy': {**_make_preset_dict('b')},
        'safe': {**_make_preset_dict('c')},
        'top3_product_ids': [],
        '_generated_at': timezone.now().isoformat(),
        '_source_research_id': str(uuid.uuid4()),
    }
    cache.clear()
    original_rates = ScopedRateThrottle.THROTTLE_RATES
    ScopedRateThrottle.THROTTLE_RATES = {**original_rates, 'preset_regenerate': '2/hour'}
    try:
        with patch(
            'design_app.services.best_of_mix_generator.generate_best_of_mix',
            return_value=fake_cache_payload,
        ):
            codes = [
                auth_client.post(
                    '/api/designs/preset-cards/regenerate-mix/',
                    {'niche_id': str(niche.id)},
                    format='json',
                ).status_code
                for _ in range(3)
            ]
    finally:
        ScopedRateThrottle.THROTTLE_RATES = original_rates
    assert codes[0] == 200
    assert codes[1] == 200
    assert codes[2] == 429


# ─── auth ─────────────────────────────────────────────────────────────────


def test_endpoints_require_authentication(workspace):
    """Anonymous client → 401/403 on each endpoint."""
    c = APIClient()  # no auth, no workspace header
    paths = [
        ('get', f'/api/designs/preset-cards/?niche_id={uuid.uuid4()}'),
        ('get', '/api/designs/preset-cards/history/'),
        ('get', '/api/designs/preset-cards/custom/'),
        ('post', '/api/designs/preset-cards/confirm/'),
        ('post', f'/api/designs/preset-cards/{uuid.uuid4()}/promote-custom/'),
        ('delete', f'/api/designs/preset-cards/{uuid.uuid4()}/custom/'),
        ('post', '/api/designs/preset-cards/regenerate-mix/'),
    ]
    for method, path in paths:
        r = getattr(c, method)(path, {}, format='json')
        assert r.status_code in (401, 403), (
            f'{method.upper()} {path} expected 401/403, got {r.status_code}'
        )

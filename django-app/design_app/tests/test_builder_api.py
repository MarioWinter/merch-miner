"""PROJ-34 Phase 5 + 6 + 13b — Builder Build API + BuilderPreset CRUD tests.

Phase 13b reshaped the Build endpoint: it now consumes a `slots` object
(8 optional strings keyed by SLOT_SCHEMA) and calls `build_form_prompt`
for the cross-product.

Tests cover: cross-product order, polish gate, niche-hint pre-fill,
serializer validation (unknown slot key), and the spatial resolver's
UUID-missing-custom path (AC-75).
"""

import uuid
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from design_app.models import (
    BuilderPreset,
    DesignProject,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='proj34@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Workspace, Membership
    ws = Workspace.objects.create(name='WS 34', slug='ws-34', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def project(workspace, user):
    return DesignProject.objects.create(
        workspace=workspace, name='School Bus Set', created_by=user,
    )


@pytest.fixture
def auth_client(user, workspace):
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return c


# ---- /builder/build/ ----------------------------------------------------------


class TestBuilderBuild:
    URL = '/api/designs/projects/{pid}/builder/build/'

    def test_happy_path_5x3_polish_off(self, auth_client, project):
        """AC-34/AC-36/AC-37: 5 slogans × 3 styles → 15 prompts in order."""
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={
                'slogans': ['A', 'B', 'C', 'D', 'E'],
                'styles': ['vintage_retro', '80s_neon', 'cartoon'],
                'background_color': 'neon_pink',
                'with_polish': False,
                'include_niche_context': False,
                'slots': {},
            },
            format='json',
        )
        assert resp.status_code == 200, resp.content
        prompts = resp.json()['prompts']
        assert len(prompts) == 15  # 5 * 3
        # Architect template + bg hex + slogan present in first prompt
        assert prompts[0].startswith('A professional vector print design')
        assert '#FF6EC7' in prompts[0]
        assert '"A"' in prompts[0]
        # Cross-product order: slogan stays at outer loop.
        assert '"A"' in prompts[1]
        assert '"E"' in prompts[14]

    @patch('design_app.api.views.polish_prompt', create=True)
    def test_polish_runs_when_with_polish_true(self, _patched, auth_client, project):
        """AC-16: with_polish=true triggers polish_prompt() per raw prompt."""
        with patch(
            'design_app.services.prompt_polish.polish_prompt',
            side_effect=lambda raw, **kw: f'<polished>{raw}</polished>',
        ) as mock_polish:
            url = self.URL.format(pid=project.id)
            resp = auth_client.post(
                url,
                data={
                    'slogans': ['Hello'],
                    'styles': ['cartoon'],
                    'background_color': 'light_gray',
                    'with_polish': True,
                    'include_niche_context': False,
                    'slots': {},
                },
                format='json',
            )
            assert resp.status_code == 200
            prompts = resp.json()['prompts']
            assert len(prompts) == 1
            assert prompts[0].startswith('<polished>')
            assert mock_polish.call_count == 1

    def test_polish_disabled_when_workspace_setting_off(self, auth_client, project, workspace):
        """EC-7: workspace polish_builder_prompts_enabled=False wins over request flag."""
        from design_app.models import ProcessingSettings
        ProcessingSettings.objects.create(
            workspace=workspace, polish_builder_prompts_enabled=False,
        )
        with patch(
            'design_app.services.prompt_polish.polish_prompt',
        ) as mock_polish:
            url = self.URL.format(pid=project.id)
            resp = auth_client.post(
                url,
                data={
                    'slogans': ['X'],
                    'styles': ['cartoon'],
                    'with_polish': True,  # but workspace says NO
                    'include_niche_context': False,
                    'slots': {},
                },
                format='json',
            )
            assert resp.status_code == 200
            mock_polish.assert_not_called()

    def test_empty_slogans_returns_400(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={'slogans': [], 'styles': ['cartoon'], 'slots': {}},
            format='json',
        )
        assert resp.status_code == 400

    def test_empty_styles_returns_400(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={'slogans': ['X'], 'styles': [], 'slots': {}},
            format='json',
        )
        assert resp.status_code == 400

    def test_cross_workspace_project_returns_404(self, auth_client, user):
        """Tenant isolation: project from a different workspace is 404."""
        from workspace_app.models import Workspace
        other = Workspace.objects.create(name='Other', slug='other', owner=user)
        other_project = DesignProject.objects.create(
            workspace=other, name='not-mine', created_by=user,
        )
        url = self.URL.format(pid=other_project.id)
        resp = auth_client.post(
            url,
            data={
                'slogans': ['x'], 'styles': ['cartoon'],
                'with_polish': False, 'slots': {},
            },
            format='json',
        )
        assert resp.status_code == 404

    def test_slots_field_accepts_all_8_keys(self, auth_client, project):
        """AC-59: serializer accepts the full 8-slot dict; values land in the
        assembled prompt verbatim (per AC-58 fallback-chain step 1).

        Phase 13l added font_combination (9 slots). Phase 13q removed
        material_texture (back to 8). The 8 keys below are the canonical set.
        """
        url = self.URL.format(pid=project.id)
        slots = {
            'spatial_configuration': 'vertical_stack',
            'visual_description': 'a vector school bus rolling forward',
            'text_segmentation': 'a single centered slogan rendered as one block of text',
            'typography_adjectives': "'massive heavyweight cartoon-block font'",
            'font_combination': '',
            'accessories': 'white radiating motion-burst lines',
            'style_dna': 'Bold cartoon aesthetic',
            'extra_context': 'High-energy kid-friendly mood',
        }
        resp = auth_client.post(
            url,
            data={
                'slogans': ['SCHOOL BUS LIFE'],
                'styles': ['cartoon'],
                'with_polish': False,
                'include_niche_context': False,
                'slots': slots,
            },
            format='json',
        )
        assert resp.status_code == 200, resp.content
        out = resp.json()['prompts'][0]
        # Spatial id resolves to its prompt_text (not the raw id)
        assert 'vertical_stack' not in out
        assert 'Vertical stack layout' in out
        # Non-spatial slot values render verbatim
        for fragment in (
            'a vector school bus rolling forward',
            'single centered slogan rendered as one block of text',
            "'massive heavyweight cartoon-block font'",
            'white radiating motion-burst lines',
            'Bold cartoon aesthetic',
            'High-energy kid-friendly mood',
        ):
            assert fragment in out

    def test_unknown_slot_key_rejected_400(self, auth_client, project):
        """AC-59 / N.4: unknown slot keys raise ValidationError."""
        url = self.URL.format(pid=project.id)
        resp = auth_client.post(
            url,
            data={
                'slogans': ['X'], 'styles': ['cartoon'],
                'with_polish': False, 'include_niche_context': False,
                'slots': {'not_a_real_slot': 'value'},
            },
            format='json',
        )
        assert resp.status_code == 400
        err_body = resp.json()
        # DRF serializer field error nests under 'slots'.
        assert 'slots' in err_body
        # The offending key name surfaces in the error message.
        assert 'not_a_real_slot' in str(err_body['slots'])

    def test_niche_hint_pre_fills_when_slots_empty(self, auth_client, project, workspace, user):
        """AC-58 / EC-24-adjacent: when slots empty and the linked niche has
        `builder_form_hints`, the view passes them into `build_form_prompt`.

        Phase 13c shipped the real `builder_form_hints` JSONField on Niche, so
        we assign the dict directly instead of monkey-patching the class.
        """
        from niche_app.models import Niche
        niche = Niche.objects.create(
            workspace=workspace, name='School Buses', created_by=user,
        )
        hints = {
            '_schema_version': 2,
            'spatial': 'vertical_stack',
            'visual': 'a stylized illustration of a vintage school bus',
            'accessories': 'a sparse scattering of small filled stars',
            'material': 'matte screenprint plastisol ink texture',
        }
        niche.builder_form_hints = hints
        niche.save(update_fields=['builder_form_hints'])
        project.niche = niche
        project.save(update_fields=['niche'])

        captured: dict = {}

        def _fake_build(slogan, style_slug, **kw):
            captured.update(kw)
            captured['slogan'] = slogan
            captured['style_slug'] = style_slug
            return f'<built {slogan} {style_slug}>'

        url = self.URL.format(pid=project.id)
        with patch(
            'design_app.services.prompt_builder.build_form_prompt',
            side_effect=_fake_build,
        ):
            resp = auth_client.post(
                url,
                data={
                    'slogans': ['X'],
                    'styles': ['cartoon'],
                    'with_polish': False,
                    'include_niche_context': True,
                    'slots': {},
                },
                format='json',
            )
        assert resp.status_code == 200, resp.content
        # The view forwarded the niche-hint dict into the prompt builder.
        assert captured.get('niche_hints') == hints
        assert captured.get('slots') == {}
        assert captured.get('workspace_id') == str(workspace.id)

    def test_slot_uuid_spatial_falls_through_to_style_default(self, auth_client, project):
        """AC-75: a UUID-shaped spatial_configuration that resolves to no
        CustomSpatial (Phase 13d not yet shipped) falls through to the style
        default (`cartoon` → 'vertical_stack')."""
        url = self.URL.format(pid=project.id)
        bogus_uuid = '00000000-1111-2222-3333-444444444444'
        resp = auth_client.post(
            url,
            data={
                'slogans': ['X'],
                'styles': ['cartoon'],
                'with_polish': False,
                'include_niche_context': False,
                'slots': {'spatial_configuration': bogus_uuid},
            },
            format='json',
        )
        assert resp.status_code == 200, resp.content
        out = resp.json()['prompts'][0]
        # The UUID itself never appears in the output.
        assert bogus_uuid not in out
        # cartoon → default_spatial_id='vertical_stack' → prompt_text below.
        assert 'Vertical stack layout' in out


# ---- /builder-presets/ -------------------------------------------------------


class TestBuilderPresetCRUD:
    URL = '/api/designs/projects/{pid}/builder-presets/'

    def test_create_list_rename_delete(self, auth_client, project, workspace, user):
        # CREATE
        resp = auth_client.post(
            self.URL.format(pid=project.id),
            data={'name': 'Set v1', 'config': {'slogans': ['hello']}},
            format='json',
        )
        assert resp.status_code == 201, resp.content
        preset_id = resp.json()['id']

        # LIST
        resp = auth_client.get(self.URL.format(pid=project.id))
        assert resp.status_code == 200
        rows = resp.json()
        assert len(rows) == 1
        assert rows[0]['name'] == 'Set v1'

        # PATCH (rename)
        resp = auth_client.patch(
            self.URL.format(pid=project.id) + f'{preset_id}/',
            data={'name': 'Set v2'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.json()['name'] == 'Set v2'

        # DELETE (soft)
        resp = auth_client.delete(
            self.URL.format(pid=project.id) + f'{preset_id}/',
        )
        assert resp.status_code == 204
        preset = BuilderPreset.objects.get(pk=preset_id)
        assert preset.is_deleted is True

        # Soft-deleted row not in LIST.
        resp = auth_client.get(self.URL.format(pid=project.id))
        assert resp.json() == []

    def test_duplicate_name_returns_400(self, auth_client, project):
        url = self.URL.format(pid=project.id)
        auth_client.post(
            url, data={'name': 'dup', 'config': {}}, format='json',
        )
        resp = auth_client.post(
            url, data={'name': 'dup', 'config': {}}, format='json',
        )
        assert resp.status_code == 400
        assert 'already exists' in resp.json().get('error', '').lower()

    def test_reuse_name_after_soft_delete(self, auth_client, project):
        """EC-19 partial unique allows name re-use after soft-delete."""
        url = self.URL.format(pid=project.id)
        r1 = auth_client.post(
            url, data={'name': 'reusable', 'config': {}}, format='json',
        )
        pid = r1.json()['id']
        auth_client.delete(url + f'{pid}/')
        r2 = auth_client.post(
            url, data={'name': 'reusable', 'config': {}}, format='json',
        )
        assert r2.status_code == 201

    def test_cross_workspace_isolation_on_list(self, auth_client, user):
        from workspace_app.models import Workspace
        other = Workspace.objects.create(name='Other', slug='o-2', owner=user)
        other_project = DesignProject.objects.create(
            workspace=other, name='x', created_by=user,
        )
        # Try to GET — different workspace → project not found in caller's ws.
        resp = auth_client.get(self.URL.format(pid=other_project.id))
        assert resp.status_code == 404

    def test_invalid_preset_id_404(self, auth_client, project):
        bogus = uuid.uuid4()
        resp = auth_client.patch(
            self.URL.format(pid=project.id) + f'{bogus}/',
            data={'name': 'x'},
            format='json',
        )
        assert resp.status_code == 404

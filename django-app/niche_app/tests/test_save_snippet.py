"""
PROJ-17 Phase 4 Step 5a -- Save Snippet endpoint tests.

Covers:
  - Auth required (401 without JWT)
  - Workspace isolation (403 on foreign niche)
  - save_as=keywords: split + duplicate handling + manual_snippet source
  - save_as=notes: creates NicheNote
  - Validation: empty text -> 400, save_as invalid -> 400
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User
from workspace_app.models import Workspace
from niche_app.models import Niche, NicheNote
from keyword_app.models import NicheKeyword


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_user(email, password="TestPass123!"):
    return User.objects.create_user(
        email=email,
        password=password,
        username=email,
        is_active=True,
    )


def auth_client(user, workspace=None):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies["access_token"] = token
    if workspace:
        client.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return client


def make_workspace_with_admin(email):
    user = make_user(email)
    workspace = Workspace.objects.get(owner=user)
    return user, workspace


def create_niche(workspace, created_by, **kwargs):
    defaults = {
        "name": "Test Niche",
        "workspace": workspace,
        "created_by": created_by,
    }
    defaults.update(kwargs)
    return Niche.objects.create(**defaults)


def url_for(niche_id):
    return reverse("niche-save-snippet", kwargs={"niche_id": niche_id})


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSaveSnippetAuth:
    def test_unauthenticated_returns_401(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = APIClient()
        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "hi", "save_as": "notes"},
            format="json",
        )
        assert resp.status_code == 401

    def test_foreign_niche_returns_403(self):
        owner, owner_ws = make_workspace_with_admin("owner@example.com")
        owner_niche = create_niche(owner_ws, owner)

        # Other user with their own workspace; not member of owner_ws
        other = make_user("other@example.com")
        other_ws = Workspace.objects.get(owner=other)

        client = auth_client(other, other_ws)
        resp = client.post(
            url_for(owner_niche.id),
            data={"selected_text": "hi", "save_as": "notes"},
            format="json",
        )
        assert resp.status_code == 403

    def test_unknown_niche_returns_403(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        client = auth_client(user, workspace)
        # Random UUID, no such niche
        resp = client.post(
            url_for("00000000-0000-0000-0000-000000000000"),
            data={"selected_text": "hi", "save_as": "notes"},
            format="json",
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestSaveSnippetKeywords:
    def test_split_by_newline_and_comma(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        text = "alpha, beta\ngamma\n delta , epsilon"
        resp = client.post(
            url_for(niche.id),
            data={"selected_text": text, "save_as": "keywords"},
            format="json",
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body == {"created": 5, "skipped": 0}

        kws = list(
            NicheKeyword.objects
            .filter(niche=niche)
            .order_by("created_at")
            .values_list("keyword", "source")
        )
        assert {k for k, _ in kws} == {"alpha", "beta", "gamma", "delta", "epsilon"}
        assert all(src == NicheKeyword.Source.MANUAL_SNIPPET for _, src in kws)

    def test_skips_duplicates_case_insensitive(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        # Pre-existing keyword (different case + different source)
        NicheKeyword.objects.create(
            niche=niche,
            keyword="Alpha",
            source=NicheKeyword.Source.MANUAL,
            created_by=user,
        )
        client = auth_client(user, workspace)

        # Body contains: existing 'alpha' (dup), 'beta' (new), 'beta' (dup within batch)
        text = "alpha\nbeta, BETA"
        resp = client.post(
            url_for(niche.id),
            data={"selected_text": text, "save_as": "keywords"},
            format="json",
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body == {"created": 1, "skipped": 1}

        keywords = set(
            NicheKeyword.objects
            .filter(niche=niche)
            .values_list("keyword", flat=True)
        )
        assert keywords == {"Alpha", "beta"}

    def test_all_duplicates_returns_200(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        NicheKeyword.objects.create(
            niche=niche,
            keyword="alpha",
            source=NicheKeyword.Source.MANUAL,
            created_by=user,
        )
        client = auth_client(user, workspace)
        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "alpha", "save_as": "keywords"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json() == {"created": 0, "skipped": 1}


@pytest.mark.django_db
class TestSaveSnippetNotes:
    def test_creates_niche_note(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        text = "Some long-form note\nwith newlines and, commas."
        resp = client.post(
            url_for(niche.id),
            data={"selected_text": text, "save_as": "notes"},
            format="json",
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["created"] == 1
        assert "note_id" in body

        notes = list(NicheNote.objects.filter(niche=niche))
        assert len(notes) == 1
        note = notes[0]
        assert note.text == text
        assert note.source_url is None
        assert note.created_by == user


@pytest.mark.django_db
class TestSaveSnippetNotesSourceUrl:
    def test_notes_with_source_url_stored(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={
                "selected_text": "interesting snippet",
                "save_as": "notes",
                "source_url": "https://example.com/page",
            },
            format="json",
        )
        assert resp.status_code == 201
        notes = list(NicheNote.objects.filter(niche=niche))
        assert len(notes) == 1
        assert notes[0].source_url == "https://example.com/page"

    def test_notes_with_source_url_null_normalizes_to_none(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={
                "selected_text": "snippet",
                "save_as": "notes",
                "source_url": None,
            },
            format="json",
        )
        assert resp.status_code == 201
        note = NicheNote.objects.get(niche=niche)
        assert note.source_url is None

    def test_notes_with_source_url_empty_string_normalizes_to_none(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={
                "selected_text": "snippet",
                "save_as": "notes",
                "source_url": "",
            },
            format="json",
        )
        assert resp.status_code == 201
        note = NicheNote.objects.get(niche=niche)
        assert note.source_url is None

    def test_notes_with_invalid_source_url_rejected(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={
                "selected_text": "snippet",
                "save_as": "notes",
                "source_url": "not-a-url",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "source_url" in resp.json()


@pytest.mark.django_db
class TestSaveSnippetValidation:
    def test_empty_text_rejected(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "", "save_as": "keywords"},
            format="json",
        )
        assert resp.status_code == 400
        assert "selected_text" in resp.json()

    def test_whitespace_only_text_rejected(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "   \n  ", "save_as": "notes"},
            format="json",
        )
        assert resp.status_code == 400
        assert "selected_text" in resp.json()

    def test_invalid_save_as_rejected(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "hi", "save_as": "garbage"},
            format="json",
        )
        assert resp.status_code == 400
        assert "save_as" in resp.json()

    def test_missing_save_as_rejected(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "hi"},
            format="json",
        )
        assert resp.status_code == 400
        assert "save_as" in resp.json()

    def test_text_over_max_length_rejected(self):
        user, workspace = make_workspace_with_admin("owner@example.com")
        niche = create_niche(workspace, user)
        client = auth_client(user, workspace)

        resp = client.post(
            url_for(niche.id),
            data={"selected_text": "a" * 5001, "save_as": "notes"},
            format="json",
        )
        assert resp.status_code == 400
        assert "selected_text" in resp.json()

"""
PROJ-5 -- Niche List: backend tests (Task 12).

Covers:
  - Create niche defaults (status, potential_rating, research_status, position)
  - GET /api/niches/ by non-member -> 403
  - Archived exclusion / inclusion
  - status_group filter
  - potential_rating filter
  - search filter
  - ordering
  - PATCH transition validation (niche_with_potential + rating combos)
  - PATCH assigned_to non-member -> 400
  - Member permission: own niche vs other member's niche
  - DELETE soft-delete
  - POST /api/niches/bulk/ archive + empty ids + member 403
  - Response includes idea_count, approved_idea_count
  - assigned_to filter integer validation (rejects non-int, accepts valid int)
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User
from workspace_app.models import Workspace, Membership
from niche_app.models import Niche


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, password="TestPass123!", active=True, **kwargs):
    return User.objects.create_user(
        email=email,
        password=password,
        username=email,
        is_active=active,
        **kwargs,
    )


def auth_client(user, workspace=None):
    """Return APIClient with JWT cookie + optional X-Workspace-Id header."""
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies["access_token"] = token
    if workspace:
        client.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return client


def make_workspace_with_admin(email):
    """Create user -> auto-created workspace + admin membership. Return (user, workspace, membership)."""
    user = make_user(email)
    workspace = Workspace.objects.get(owner=user)
    membership = Membership.objects.get(
        user=user, workspace=workspace, status=Membership.Status.ACTIVE,
    )
    return user, workspace, membership


def add_member(workspace, email, role=Membership.Role.MEMBER):
    """Add an active member to workspace. Return (user, membership)."""
    user = make_user(email)
    # Delete auto-created workspace membership so it doesn't interfere
    membership = Membership.objects.create(
        workspace=workspace,
        user=user,
        role=role,
        status=Membership.Status.ACTIVE,
    )
    return user, membership


def create_niche(workspace, created_by, **kwargs):
    defaults = {
        "name": "Test Niche",
        "workspace": workspace,
        "created_by": created_by,
    }
    defaults.update(kwargs)
    return Niche.objects.create(**defaults)


# ---------------------------------------------------------------------------
# URLs
# ---------------------------------------------------------------------------

LIST_URL = reverse("niche-list")
BULK_URL = reverse("niche-bulk")


def detail_url(niche_id):
    return reverse("niche-detail", kwargs={"pk": niche_id})


# ---------------------------------------------------------------------------
# 1. Create niche -> defaults
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_create_niche_defaults():
    admin, ws, _ = make_workspace_with_admin("create@test.com")
    client = auth_client(admin, ws)

    response = client.post(LIST_URL, {"name": "Dog T-Shirts"}, format="json")
    assert response.status_code == 201

    # NicheCreateSerializer returns only name/notes; verify defaults via DB
    niche = Niche.objects.get(name="Dog T-Shirts", workspace=ws)
    assert niche.status == Niche.Status.DATA_ENTRY
    assert niche.potential_rating is None
    assert niche.research_status is None
    assert niche.position == 0
    assert niche.created_by == admin
    assert niche.workspace == ws


# ---------------------------------------------------------------------------
# 2. GET /api/niches/ by non-member -> 403
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_list_niches_non_member_403():
    admin, ws, _ = make_workspace_with_admin("admin403@test.com")
    outsider = make_user("outsider@test.com")

    # outsider uses admin's workspace header
    client = auth_client(outsider, ws)
    response = client.get(LIST_URL)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 3. GET excludes archived by default; ?status=archived includes them
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_archived_excluded_by_default():
    admin, ws, _ = make_workspace_with_admin("arch@test.com")
    create_niche(ws, admin, name="Active Niche")
    create_niche(ws, admin, name="Archived Niche", status=Niche.Status.ARCHIVED)

    client = auth_client(admin, ws)

    # Default: archived excluded
    response = client.get(LIST_URL)
    assert response.status_code == 200
    names = [n["name"] for n in response.json()["results"]]
    assert "Active Niche" in names
    assert "Archived Niche" not in names

    # Explicit ?status=archived -> included
    response = client.get(LIST_URL, {"status": "archived"})
    assert response.status_code == 200
    names = [n["name"] for n in response.json()["results"]]
    assert "Archived Niche" in names


# ---------------------------------------------------------------------------
# 4. ?status_group=todo -> data_entry + deep_research + niche_with_potential
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_status_group_todo_filter():
    admin, ws, _ = make_workspace_with_admin("group@test.com")
    create_niche(ws, admin, name="N1", status=Niche.Status.DATA_ENTRY)
    create_niche(ws, admin, name="N2", status=Niche.Status.DEEP_RESEARCH)
    create_niche(
        ws, admin, name="N3",
        status=Niche.Status.NICHE_WITH_POTENTIAL,
        potential_rating=Niche.PotentialRating.GOOD,
    )
    create_niche(ws, admin, name="N4", status=Niche.Status.TO_DESIGNER)
    create_niche(ws, admin, name="N5", status=Niche.Status.WINNER)

    client = auth_client(admin, ws)
    response = client.get(LIST_URL, {"status_group": "todo"})
    assert response.status_code == 200
    names = {n["name"] for n in response.json()["results"]}
    assert names == {"N1", "N2", "N3"}


# ---------------------------------------------------------------------------
# 5. ?potential_rating=rejected -> filtered correctly
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_potential_rating_filter():
    admin, ws, _ = make_workspace_with_admin("rating@test.com")
    create_niche(ws, admin, name="Good", potential_rating=Niche.PotentialRating.GOOD)
    create_niche(ws, admin, name="Rejected", potential_rating=Niche.PotentialRating.REJECTED)
    create_niche(ws, admin, name="None", potential_rating=None)

    client = auth_client(admin, ws)
    response = client.get(LIST_URL, {"potential_rating": "rejected"})
    assert response.status_code == 200
    names = [n["name"] for n in response.json()["results"]]
    assert names == ["Rejected"]


# ---------------------------------------------------------------------------
# 6. ?search=shoes -> icontains; empty search -> all
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_search_filter():
    admin, ws, _ = make_workspace_with_admin("search@test.com")
    create_niche(ws, admin, name="Running Shoes")
    create_niche(ws, admin, name="Dog T-Shirts")

    client = auth_client(admin, ws)

    # search match
    response = client.get(LIST_URL, {"search": "shoes"})
    assert response.status_code == 200
    names = [n["name"] for n in response.json()["results"]]
    assert "Running Shoes" in names
    assert "Dog T-Shirts" not in names

    # empty search -> all
    response = client.get(LIST_URL, {"search": ""})
    assert response.status_code == 200
    assert len(response.json()["results"]) == 2


# ---------------------------------------------------------------------------
# 7. ?ordering=-created_at -> newest first
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_ordering_newest_first():
    admin, ws, _ = make_workspace_with_admin("order@test.com")
    n1 = create_niche(ws, admin, name="First")
    n2 = create_niche(ws, admin, name="Second")

    client = auth_client(admin, ws)
    response = client.get(LIST_URL, {"ordering": "-created_at"})
    assert response.status_code == 200
    results = response.json()["results"]
    assert results[0]["name"] == "Second"
    assert results[1]["name"] == "First"


# ---------------------------------------------------------------------------
# 8. PATCH status=niche_with_potential without rating -> 400
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_patch_nwp_without_rating_400():
    admin, ws, _ = make_workspace_with_admin("nwp1@test.com")
    niche = create_niche(ws, admin, name="Test")

    client = auth_client(admin, ws)
    response = client.patch(
        detail_url(niche.id),
        {"status": "niche_with_potential"},
        format="json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 9. PATCH potential_rating=rejected then status=niche_with_potential -> 400
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_patch_rejected_then_nwp_400():
    admin, ws, _ = make_workspace_with_admin("nwp2@test.com")
    niche = create_niche(ws, admin, name="Test", potential_rating=Niche.PotentialRating.REJECTED)

    client = auth_client(admin, ws)
    response = client.patch(
        detail_url(niche.id),
        {"status": "niche_with_potential"},
        format="json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 10. PATCH potential_rating=good then status=niche_with_potential -> 200
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_patch_good_then_nwp_200():
    admin, ws, _ = make_workspace_with_admin("nwp3@test.com")
    niche = create_niche(ws, admin, name="Test", potential_rating=Niche.PotentialRating.GOOD)

    client = auth_client(admin, ws)
    response = client.patch(
        detail_url(niche.id),
        {"status": "niche_with_potential"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["status"] == "niche_with_potential"


# ---------------------------------------------------------------------------
# 11. PATCH assigned_to = user not in workspace -> 400
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_patch_assigned_to_non_member_400():
    admin, ws, _ = make_workspace_with_admin("assign@test.com")
    outsider = make_user("notmember@test.com")
    niche = create_niche(ws, admin, name="Test")

    client = auth_client(admin, ws)
    response = client.patch(
        detail_url(niche.id),
        {"assigned_to": str(outsider.id)},
        format="json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 12. Member PATCH own niche -> 200; PATCH other member's niche -> 403
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_member_patch_own_vs_others_niche():
    admin, ws, _ = make_workspace_with_admin("permadmin@test.com")
    member, _ = add_member(ws, "permmember@test.com")
    other_member, _ = add_member(ws, "othermember@test.com")

    own_niche = create_niche(ws, member, name="My Niche", assigned_to=member)
    other_niche = create_niche(ws, other_member, name="Other Niche", assigned_to=other_member)

    client = auth_client(member, ws)

    # PATCH own niche -> 200
    response = client.patch(
        detail_url(own_niche.id),
        {"name": "Updated"},
        format="json",
    )
    assert response.status_code == 200

    # PATCH other's niche -> 403
    response = client.patch(
        detail_url(other_niche.id),
        {"name": "Hacked"},
        format="json",
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 13. DELETE -> status=archived, row still in DB, 204
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_delete_soft_deletes():
    admin, ws, _ = make_workspace_with_admin("del@test.com")
    niche = create_niche(ws, admin, name="To Archive")

    client = auth_client(admin, ws)
    response = client.delete(detail_url(niche.id))
    assert response.status_code == 204

    # Row still exists with archived status
    niche.refresh_from_db()
    assert niche.status == Niche.Status.ARCHIVED


# ---------------------------------------------------------------------------
# 14. POST /api/niches/bulk/ archive 2 niches -> 200, {"updated": 2}
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_bulk_archive():
    admin, ws, _ = make_workspace_with_admin("bulk@test.com")
    n1 = create_niche(ws, admin, name="B1")
    n2 = create_niche(ws, admin, name="B2")

    client = auth_client(admin, ws)
    response = client.post(
        BULK_URL,
        {"ids": [str(n1.id), str(n2.id)], "action": "archive"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["updated"] == 2

    n1.refresh_from_db()
    n2.refresh_from_db()
    assert n1.status == Niche.Status.ARCHIVED
    assert n2.status == Niche.Status.ARCHIVED


# ---------------------------------------------------------------------------
# 15. POST /api/niches/bulk/ empty ids -> 400
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_bulk_empty_ids_400():
    admin, ws, _ = make_workspace_with_admin("bulkempty@test.com")
    client = auth_client(admin, ws)
    response = client.post(
        BULK_URL,
        {"ids": [], "action": "archive"},
        format="json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 16. POST /api/niches/bulk/ by member (not admin) -> 403
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_bulk_member_403():
    admin, ws, _ = make_workspace_with_admin("bulkadm@test.com")
    member, _ = add_member(ws, "bulkmember@test.com")
    n1 = create_niche(ws, admin, name="B1")

    client = auth_client(member, ws)
    response = client.post(
        BULK_URL,
        {"ids": [str(n1.id)], "action": "archive"},
        format="json",
    )
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 17. GET /api/niches/ response includes idea_count, approved_idea_count
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_response_includes_idea_counts():
    admin, ws, _ = make_workspace_with_admin("counts@test.com")
    create_niche(ws, admin, name="CountNiche")

    client = auth_client(admin, ws)
    response = client.get(LIST_URL)
    assert response.status_code == 200
    result = response.json()["results"][0]
    assert "idea_count" in result
    assert "approved_idea_count" in result
    # No ideas linked yet -> both 0
    assert result["idea_count"] == 0
    assert result["approved_idea_count"] == 0


# ---------------------------------------------------------------------------
# 18. ?assigned_to=not-a-number -> 400 (integer validation)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_filter_assigned_to_non_integer_400():
    admin, ws, _ = make_workspace_with_admin("assignfilter@test.com")
    create_niche(ws, admin, name="Test")

    client = auth_client(admin, ws)
    response = client.get(LIST_URL, {"assigned_to": "not-a-number"})
    assert response.status_code == 400
    assert response.json()["assigned_to"] == "Must be a valid user ID (integer)."


# ---------------------------------------------------------------------------
# 19. ?assigned_to=<valid_int> -> 200
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_filter_assigned_to_valid_integer_200():
    admin, ws, _ = make_workspace_with_admin("assignvalid@test.com")
    create_niche(ws, admin, name="Assigned", assigned_to=admin)

    client = auth_client(admin, ws)
    response = client.get(LIST_URL, {"assigned_to": str(admin.id)})
    assert response.status_code == 200
    names = [n["name"] for n in response.json()["results"]]
    assert "Assigned" in names

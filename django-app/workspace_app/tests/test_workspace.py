"""
PROJ-4 — Workspace & Membership: backend tests.

Covers task-list item 10:
  - Workspace auto-created on user registration (signal)
  - GET /api/workspaces/me/
  - PATCH /api/workspaces/{id}/  (admin 200, member 403)
  - Invite flow end-to-end (POST → token → accept → membership active)
  - Expired token → 400
  - Remove non-owner member → 204; remove owner → 403
  - Duplicate invite → 409
"""

import pytest
from unittest.mock import patch
from django.urls import reverse
from django.core import signing
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User
from workspace_app.models import Workspace, Membership


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


def auth_client(user):
    """Return an APIClient with the user's access token in the cookie."""
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies["access_token"] = token
    return client


# ---------------------------------------------------------------------------
# 1. Signal — auto-create personal workspace on user registration
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_workspace_auto_created_on_user_registration():
    user = make_user("signal@test.com")
    assert Workspace.objects.filter(owner=user).exists(), "Personal workspace not created"
    assert Membership.objects.filter(
        user=user,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
    ).exists(), "Admin membership not created"


@pytest.mark.django_db
def test_workspace_not_duplicated_when_user_already_has_membership():
    """Signal must skip if user already has a membership (shouldn't happen in normal flow,
    but guard against double-triggers)."""
    user = make_user("nodedup@test.com")
    count_before = Workspace.objects.filter(owner=user).count()
    # Simulate a second post_save by calling the signal directly
    from workspace_app.signals import auto_create_personal_workspace
    auto_create_personal_workspace(sender=User, instance=user, created=True)
    assert Workspace.objects.filter(owner=user).count() == count_before


# ---------------------------------------------------------------------------
# 2. GET /api/workspaces/me/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_get_workspaces_me_returns_user_workspaces():
    user = make_user("wsme@test.com")
    client = auth_client(user)
    url = reverse("workspace-me")
    response = client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"].startswith("wsme")


@pytest.mark.django_db
def test_get_workspaces_me_includes_role():
    user = make_user("wsrole@test.com")
    client = auth_client(user)
    url = reverse("workspace-me")
    response = client.get(url)
    assert response.status_code == 200
    data = response.json()
    assert data[0]["role"] == Membership.Role.ADMIN


@pytest.mark.django_db
def test_get_workspaces_me_excludes_pending_memberships():
    """Pending memberships must not appear in /me/ list."""
    admin_user = make_user("wsadmin@test.com")
    invited_user = make_user("wsinvited@test.com")
    workspace = Workspace.objects.get(owner=admin_user)
    # invited_user has only a pending membership in admin_user's workspace
    Membership.objects.create(
        workspace=workspace,
        user=invited_user,
        role=Membership.Role.MEMBER,
        status=Membership.Status.PENDING,
    )
    client = auth_client(invited_user)
    url = reverse("workspace-me")
    response = client.get(url)
    assert response.status_code == 200
    # invited_user's own auto-created workspace is active; admin's workspace is pending → excluded
    workspace_ids = [w["id"] for w in response.json()]
    assert str(workspace.id) not in workspace_ids


@pytest.mark.django_db
def test_get_workspaces_me_unauthenticated():
    client = APIClient()
    url = reverse("workspace-me")
    response = client.get(url)
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 3. PATCH /api/workspaces/{id}/  — rename
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_patch_workspace_by_admin_returns_200():
    user = make_user("patchadmin@test.com")
    workspace = Workspace.objects.get(owner=user)
    client = auth_client(user)
    url = reverse("workspace-detail", kwargs={"workspace_id": workspace.id})
    response = client.patch(url, {"name": "Renamed WS"}, format="json")
    assert response.status_code == 200
    workspace.refresh_from_db()
    assert workspace.name == "Renamed WS"


@pytest.mark.django_db
def test_patch_workspace_by_member_returns_403():
    admin = make_user("patchadm2@test.com")
    member = make_user("patchmember@test.com")
    workspace = Workspace.objects.get(owner=admin)
    Membership.objects.create(
        workspace=workspace,
        user=member,
        role=Membership.Role.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    client = auth_client(member)
    url = reverse("workspace-detail", kwargs={"workspace_id": workspace.id})
    response = client.patch(url, {"name": "Hacked"}, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_patch_workspace_non_member_returns_403():
    owner = make_user("patchowner@test.com")
    outsider = make_user("outsider@test.com")
    workspace = Workspace.objects.get(owner=owner)
    client = auth_client(outsider)
    url = reverse("workspace-detail", kwargs={"workspace_id": workspace.id})
    response = client.patch(url, {"name": "Hacked"}, format="json")
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 4. Invite flow end-to-end  (POST → token → accept → membership active)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_invite_flow_end_to_end():
    admin = make_user("inviteadmin@test.com")
    workspace = Workspace.objects.get(owner=admin)
    invite_email = "newinvitee@test.com"

    invite_url = reverse("workspace-invite", kwargs={"workspace_id": workspace.id})
    accept_url = reverse("workspace-invite-accept")

    client = auth_client(admin)

    # POST invite — enqueue is mocked so no real Redis needed
    with patch("django_rq.enqueue"):
        response = client.post(invite_url, {"email": invite_email}, format="json")
    assert response.status_code == 201

    # Membership must be pending
    invited_user = User.objects.get(email=invite_email)
    membership = Membership.objects.get(workspace=workspace, user=invited_user)
    assert membership.status == Membership.Status.PENDING

    # Build the token exactly as the view does
    token = signing.dumps({"workspace_id": str(workspace.id), "user_id": str(invited_user.id)})

    # Accept invite — public endpoint
    public_client = APIClient()
    response = public_client.get(accept_url, {"token": token})
    assert response.status_code == 200

    membership.refresh_from_db()
    assert membership.status == Membership.Status.ACTIVE
    assert membership.accepted_at is not None


# ---------------------------------------------------------------------------
# 5. Expired token → 400
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_accept_invite_expired_token_returns_400():
    admin = make_user("expiredadmin@test.com")
    workspace = Workspace.objects.get(owner=admin)
    invite_email = "expiredee@test.com"
    invited_user = make_user(invite_email, active=False)
    Membership.objects.create(
        workspace=workspace,
        user=invited_user,
        role=Membership.Role.MEMBER,
        status=Membership.Status.PENDING,
    )

    token = signing.dumps(
        {"workspace_id": str(workspace.id), "user_id": str(invited_user.id)}
    )

    accept_url = reverse("workspace-invite-accept")
    public_client = APIClient()

    # Patch loads to raise SignatureExpired
    with patch(
        "workspace_app.api.views.signing.loads",
        side_effect=signing.SignatureExpired("expired"),
    ):
        response = public_client.get(accept_url, {"token": token})

    assert response.status_code == 400
    assert "expired" in response.json()["error"].lower()


# ---------------------------------------------------------------------------
# 6. Remove non-owner member → 204; remove owner → 403
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_remove_non_owner_member_returns_204():
    admin = make_user("rmadmin@test.com")
    member = make_user("rmmember@test.com")
    workspace = Workspace.objects.get(owner=admin)
    Membership.objects.create(
        workspace=workspace,
        user=member,
        role=Membership.Role.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    client = auth_client(admin)
    url = reverse(
        "workspace-member-detail",
        kwargs={"workspace_id": workspace.id, "user_id": member.id},
    )
    response = client.delete(url)
    assert response.status_code == 204
    assert not Membership.objects.filter(workspace=workspace, user=member).exists()


@pytest.mark.django_db
def test_remove_owner_member_returns_403():
    admin = make_user("rmown@test.com")
    workspace = Workspace.objects.get(owner=admin)
    client = auth_client(admin)
    url = reverse(
        "workspace-member-detail",
        kwargs={"workspace_id": workspace.id, "user_id": admin.id},
    )
    response = client.delete(url)
    assert response.status_code == 403
    assert "owner" in response.json()["error"].lower()


# ---------------------------------------------------------------------------
# 7. Duplicate invite → 409
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_duplicate_active_invite_returns_409():
    admin = make_user("dupinvadmin@test.com")
    workspace = Workspace.objects.get(owner=admin)
    existing_member = make_user("dupinvmember@test.com")
    Membership.objects.create(
        workspace=workspace,
        user=existing_member,
        role=Membership.Role.MEMBER,
        status=Membership.Status.ACTIVE,
    )
    client = auth_client(admin)
    invite_url = reverse("workspace-invite", kwargs={"workspace_id": workspace.id})
    with patch("django_rq.enqueue"):
        response = client.post(invite_url, {"email": existing_member.email}, format="json")
    assert response.status_code == 409


@pytest.mark.django_db
def test_pending_invite_resend_returns_200():
    """Re-inviting a pending member must return 200 (resend), not 409."""
    admin = make_user("resendadm@test.com")
    workspace = Workspace.objects.get(owner=admin)
    pending_user = make_user("resendpending@test.com", active=False)
    Membership.objects.create(
        workspace=workspace,
        user=pending_user,
        role=Membership.Role.MEMBER,
        status=Membership.Status.PENDING,
    )
    client = auth_client(admin)
    invite_url = reverse("workspace-invite", kwargs={"workspace_id": workspace.id})
    with patch("django_rq.enqueue"):
        response = client.post(invite_url, {"email": pending_user.email}, format="json")
    assert response.status_code == 200
    assert "resent" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# BUG-5 — Owner/last-admin demotion guard
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_cannot_demote_owner():
    """PATCH role on workspace owner must return 403."""
    owner = make_user("ownerdmote@test.com")
    workspace = Workspace.objects.get(owner=owner)
    client = auth_client(owner)
    url = reverse(
        "workspace-member-detail",
        kwargs={"workspace_id": workspace.id, "user_id": owner.id},
    )
    response = client.patch(url, {"role": Membership.Role.MEMBER}, format="json")
    assert response.status_code == 403
    assert "owner" in response.json()["error"].lower()


@pytest.mark.django_db
def test_cannot_demote_last_admin():
    """Demoting the only admin must return 403."""
    owner = make_user("lastadmin@test.com")
    workspace = Workspace.objects.get(owner=owner)
    # owner is the sole admin; try demoting another admin (but there's only one — the owner)
    # Add a second user as admin, then have a third user who is the only remaining admin
    second_admin = make_user("secondadm@test.com")
    Membership.objects.create(
        workspace=workspace,
        user=second_admin,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
    )
    # Demote owner first via DB to create a scenario where second_admin is the only admin
    owner_membership = Membership.objects.get(workspace=workspace, user=owner)
    owner_membership.role = Membership.Role.MEMBER
    owner_membership.save(update_fields=["role"])
    # Now second_admin is the sole admin — try to demote them (as owner acting as member)
    # Use second_admin's own client (they're still admin)
    client = auth_client(second_admin)
    url = reverse(
        "workspace-member-detail",
        kwargs={"workspace_id": workspace.id, "user_id": second_admin.id},
    )
    response = client.patch(url, {"role": Membership.Role.MEMBER}, format="json")
    assert response.status_code == 403
    assert "admin" in response.json()["error"].lower()


@pytest.mark.django_db
def test_can_demote_admin_when_multiple_exist():
    """Demoting one admin when two exist must succeed (200)."""
    owner = make_user("multiowneradm@test.com")
    workspace = Workspace.objects.get(owner=owner)
    second_admin = make_user("multisecondadm@test.com")
    Membership.objects.create(
        workspace=workspace,
        user=second_admin,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
    )
    client = auth_client(owner)
    url = reverse(
        "workspace-member-detail",
        kwargs={"workspace_id": workspace.id, "user_id": second_admin.id},
    )
    response = client.patch(url, {"role": Membership.Role.MEMBER}, format="json")
    assert response.status_code == 200
    second_admin_membership = Membership.objects.get(workspace=workspace, user=second_admin)
    assert second_admin_membership.role == Membership.Role.MEMBER


# ---------------------------------------------------------------------------
# BUG-3 — Slug collision retry loop
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_slug_retries_on_collision():
    """Signal generates a unique slug even when the base slug already exists."""
    from django.utils.text import slugify

    user1 = make_user("slugcollide1@test.com")
    base_slug = slugify(f"{user1.email.split('@')[0]}'s Workspace")

    # Manually create a workspace with the same base slug to force collision
    Workspace.objects.filter(owner=user1).update(slug=base_slug)

    # Create second user whose email produces the same base slug
    user2 = make_user("slugcollide1@example.com")
    ws2 = Workspace.objects.get(owner=user2)
    # Both workspaces were created; ws2 must have a different slug
    ws1 = Workspace.objects.get(owner=user1)
    assert ws1.slug != ws2.slug


@pytest.mark.django_db
def test_slug_raises_after_max_retries():
    """RuntimeError raised when all 10 slug attempts collide."""
    from workspace_app.signals import auto_create_personal_workspace
    from unittest.mock import patch, MagicMock

    user = make_user("slugexhaust@test.com")

    # Patch at the models layer (signals imports Workspace from workspace_app.models)
    always_exists = MagicMock()
    always_exists.exists.return_value = True

    no_memberships = MagicMock()
    no_memberships.exists.return_value = False

    def workspace_filter(**kwargs):
        return always_exists

    def membership_filter(**kwargs):
        return no_memberships

    with patch("workspace_app.models.Workspace.objects.filter", side_effect=workspace_filter):
        with patch("workspace_app.models.Membership.objects.filter", side_effect=membership_filter):
            with pytest.raises(RuntimeError, match="10 attempts"):
                auto_create_personal_workspace(
                    sender=user.__class__, instance=user, created=True
                )

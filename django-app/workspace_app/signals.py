from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings
from django.utils.text import slugify
import random
import string


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def auto_create_personal_workspace(sender, instance, created, **kwargs):
    """Auto-create a personal Workspace + admin Membership on new user creation."""
    if not created:
        return

    from workspace_app.models import Workspace, Membership

    # Only create if the user has no memberships yet
    if Membership.objects.filter(user=instance).exists():
        return

    base_name = f"{instance.email.split('@')[0]}'s Workspace"
    base_slug = slugify(base_name)[:106]  # leave room for suffix

    slug = base_slug
    for _ in range(10):
        if not Workspace.objects.filter(slug=slug).exists():
            break
        slug = f"{base_slug}-{''.join(random.choices(string.ascii_lowercase + string.digits, k=4))}"
    else:
        raise RuntimeError("Could not generate unique slug after 10 attempts.")

    workspace = Workspace.objects.create(
        name=base_name,
        slug=slug,
        owner=instance,
    )

    Membership.objects.create(
        workspace=workspace,
        user=instance,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
        invited_by=None,
        accepted_at=workspace.created_at,
    )

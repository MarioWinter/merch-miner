"""PROJ-29 Phase 1A — Restore-version admin view (AC-20)."""

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory

from chat_node_config_app.admin import ChatNodeConfigAdmin
from chat_node_config_app.models import ChatNodeConfig, ChatNodeConfigVersion

User = get_user_model()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(email='admin@example.com', password='pw')


@pytest.mark.django_db
def test_restore_view_copies_snapshot_back(admin_user):
    """Restore view writes a previous version's fields back onto the active row."""
    row, _ = ChatNodeConfig.objects.update_or_create(
        node_name='agent_react',
        defaults={
            'model_name': 'openai/gpt-4.1-mini',
            'temperature': 0.3,
            'system_prompt': 'original-prompt',
            'updated_by': admin_user,
        },
    )

    row.system_prompt = 'changed-v1'
    row.save()
    row.system_prompt = 'changed-v2'
    row.save()

    original_version = ChatNodeConfigVersion.objects.filter(
        node_name='agent_react', system_prompt='original-prompt',
    ).first()
    assert original_version is not None

    admin_instance = ChatNodeConfigAdmin(ChatNodeConfig, AdminSite())
    request = RequestFactory().post('/admin/')
    request.user = admin_user
    request._messages = type('M', (), {'add': lambda *a, **k: None})()

    admin_instance.restore_view(request, row.pk, original_version.pk)

    row.refresh_from_db()
    assert row.system_prompt == 'original-prompt'


@pytest.mark.django_db
def test_restore_view_rejects_cross_node_version(admin_user):
    """Restoring a version from a different node leaves the target row untouched."""
    row_a, _ = ChatNodeConfig.objects.update_or_create(
        node_name='agent_react',
        defaults={
            'model_name': 'openai/gpt-4.1-mini',
            'temperature': 0.3,
            'system_prompt': 'a-original',
        },
    )
    ChatNodeConfig.objects.update_or_create(
        node_name='creative_techniques',
        defaults={
            'model_name': 'mistralai/mistral-small-creative',
            'temperature': 0.7,
            'system_prompt': 'b-original',
        },
    )
    version_b = ChatNodeConfigVersion.objects.filter(
        node_name='creative_techniques', system_prompt='b-original',
    ).first()
    assert version_b is not None

    admin_instance = ChatNodeConfigAdmin(ChatNodeConfig, AdminSite())
    request = RequestFactory().post('/admin/')
    request.user = admin_user
    request._messages = type('M', (), {'add': lambda *a, **k: None})()

    admin_instance.restore_view(request, row_a.pk, version_b.pk)

    row_a.refresh_from_db()
    assert row_a.system_prompt == 'a-original'
    assert row_a.model_name == 'openai/gpt-4.1-mini'

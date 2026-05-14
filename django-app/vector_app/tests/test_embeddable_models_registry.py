"""PROJ-29 Phase 1B Round 1: Idea + NicheNote registered in vector_app embeddable-models registry.

Signal handlers wrap `queue.enqueue(...)` in `transaction.on_commit(...)` per
AC-Ops-RQ-1 — pytest-django's `db` fixture wraps tests in a rolled-back
transaction, so `on_commit` callbacks only fire when explicitly captured via
`django_capture_on_commit_callbacks`.
"""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction

from idea_app.models import Idea
from niche_app.models import Niche, NicheNote
from vector_app import signals as vector_signals
from vector_app.tasks import create_or_update_embedding, delete_embedding
from workspace_app.models import Workspace

User = get_user_model()


def test_idea_in_embeddable_models():
    """Idea must appear in the lazy registry."""
    vector_signals._EMBEDDABLE_MODELS = None
    models = vector_signals._get_embeddable_models()
    assert Idea in models


def test_nichenote_in_embeddable_models():
    """NicheNote must appear in the lazy registry."""
    vector_signals._EMBEDDABLE_MODELS = None
    models = vector_signals._get_embeddable_models()
    assert NicheNote in models


@pytest.fixture
def user(db):
    return User.objects.create_user(email='proj29-registry@example.com', password='pw')


@pytest.fixture
def workspace(db, user):
    return Workspace.objects.create(name='Test WS', slug='test-ws-registry', owner=user)


@pytest.fixture
def niche(db, user, workspace):
    return Niche.objects.create(name='Bus Driver', workspace=workspace, created_by=user)


def _mock_queue():
    fake_queue = MagicMock()
    fake_queue.enqueue = MagicMock()
    return fake_queue


@pytest.mark.django_db(transaction=True)
def test_post_save_signal_enqueues_for_idea(user, workspace, niche):
    """Saving an Idea enqueues a create_or_update_embedding job after commit."""
    fake_queue = _mock_queue()
    with patch('vector_app.signals.django_rq.get_queue', return_value=fake_queue):
        Idea.objects.create(
            workspace=workspace,
            niche=niche,
            slogan_text='Registry verification slogan',
            created_by=user,
        )
    enqueued_funcs = [call.args[0] for call in fake_queue.enqueue.call_args_list]
    assert create_or_update_embedding in enqueued_funcs


@pytest.mark.django_db(transaction=True)
def test_post_save_signal_enqueues_for_nichenote(user, niche):
    """Saving a NicheNote enqueues a create_or_update_embedding job after commit."""
    fake_queue = _mock_queue()
    with patch('vector_app.signals.django_rq.get_queue', return_value=fake_queue):
        NicheNote.objects.create(niche=niche, text='Registry note', created_by=user)
    enqueued_funcs = [call.args[0] for call in fake_queue.enqueue.call_args_list]
    assert create_or_update_embedding in enqueued_funcs


@pytest.mark.django_db(transaction=True)
def test_post_delete_signal_enqueues_for_idea(user, workspace, niche):
    """Deleting an Idea enqueues a delete_embedding job after commit."""
    idea = Idea.objects.create(
        workspace=workspace, niche=niche, slogan_text='to delete', created_by=user,
    )
    fake_queue = _mock_queue()
    with patch('vector_app.signals.django_rq.get_queue', return_value=fake_queue):
        idea.delete()
    enqueued_funcs = [call.args[0] for call in fake_queue.enqueue.call_args_list]
    assert delete_embedding in enqueued_funcs


@pytest.mark.django_db(transaction=True)
def test_post_delete_signal_enqueues_for_nichenote(user, niche):
    """Deleting a NicheNote enqueues a delete_embedding job after commit."""
    note = NicheNote.objects.create(niche=niche, text='to delete', created_by=user)
    fake_queue = _mock_queue()
    with patch('vector_app.signals.django_rq.get_queue', return_value=fake_queue):
        note.delete()
    enqueued_funcs = [call.args[0] for call in fake_queue.enqueue.call_args_list]
    assert delete_embedding in enqueued_funcs


@pytest.mark.django_db(transaction=True)
def test_rolled_back_transaction_does_not_enqueue(user, workspace, niche):
    """Save inside a rolled-back transaction MUST NOT enqueue (AC-Ops-RQ-1)."""
    fake_queue = _mock_queue()
    with patch('vector_app.signals.django_rq.get_queue', return_value=fake_queue):
        try:
            with transaction.atomic():
                Idea.objects.create(
                    workspace=workspace,
                    niche=niche,
                    slogan_text='this transaction will rollback',
                    created_by=user,
                )
                raise RuntimeError('force rollback')
        except RuntimeError:
            pass
    enqueued_funcs = [call.args[0] for call in fake_queue.enqueue.call_args_list]
    assert create_or_update_embedding not in enqueued_funcs

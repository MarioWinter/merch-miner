"""PROJ-29 Phase 1B Round 3: backfill_niche_rag management command."""

from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from idea_app.models import Idea
from niche_app.models import Niche
from workspace_app.models import Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='proj29-backfill@example.com', password='pw')


@pytest.fixture
def workspace(db, user):
    return Workspace.objects.create(name='WS-BF', slug='ws-bf', owner=user)


@pytest.fixture
def niche(db, user, workspace):
    return Niche.objects.create(name='Bus Driver', workspace=workspace, created_by=user)


@pytest.fixture
def ten_ideas(db, niche, user, workspace):
    return [
        Idea.objects.create(
            workspace=workspace, niche=niche,
            slogan_text=f'Slogan {i}', created_by=user,
        )
        for i in range(10)
    ]


@pytest.mark.django_db
def test_dry_run_does_not_enqueue(ten_ideas):
    fake_queue = MagicMock()
    out = StringIO()
    with patch(
        'vector_app.management.commands.backfill_niche_rag.django_rq.get_queue',
        return_value=fake_queue,
    ):
        call_command('backfill_niche_rag', '--content-type', 'slogan', '--dry-run', stdout=out)

    fake_queue.enqueue.assert_not_called()
    output = out.getvalue()
    assert 'rows to process   : 10' in output
    assert '--dry-run' in output


@pytest.mark.django_db
def test_budget_overrun_aborts(ten_ideas):
    out = StringIO()
    err = StringIO()
    fake_queue = MagicMock()
    with patch(
        'vector_app.management.commands.backfill_niche_rag.django_rq.get_queue',
        return_value=fake_queue,
    ), pytest.raises(SystemExit) as exc:
        call_command(
            'backfill_niche_rag',
            '--content-type', 'slogan',
            '--budget', '0.0000001',
            stdout=out, stderr=err,
        )
    assert exc.value.code == 2
    assert 'Budget' in err.getvalue()
    fake_queue.enqueue.assert_not_called()


@pytest.mark.django_db
def test_enqueues_one_job_per_idea(ten_ideas):
    fake_queue = MagicMock()
    out = StringIO()
    with patch(
        'vector_app.management.commands.backfill_niche_rag.django_rq.get_queue',
        return_value=fake_queue,
    ):
        call_command('backfill_niche_rag', '--content-type', 'slogan', '--budget', '100', stdout=out)
    assert fake_queue.enqueue.call_count == 10


@pytest.mark.django_db
def test_reembed_flag_propagated_to_task(ten_ideas):
    fake_queue = MagicMock()
    out = StringIO()
    with patch(
        'vector_app.management.commands.backfill_niche_rag.django_rq.get_queue',
        return_value=fake_queue,
    ):
        call_command(
            'backfill_niche_rag',
            '--content-type', 'slogan',
            '--reembed-existing',
            '--budget', '100',
            stdout=out,
        )
    # 4th positional arg of create_or_update_embedding is force_reembed.
    reembed_args = [call.args[4] for call in fake_queue.enqueue.call_args_list]
    assert all(arg is True for arg in reembed_args)


@pytest.mark.django_db
def test_niche_filter_limits_rows(db, user, workspace, ten_ideas):
    other_niche = Niche.objects.create(
        name='Other', workspace=workspace, created_by=user,
    )
    for i in range(3):
        Idea.objects.create(
            workspace=workspace, niche=other_niche,
            slogan_text=f'Other slogan {i}', created_by=user,
        )

    fake_queue = MagicMock()
    out = StringIO()
    with patch(
        'vector_app.management.commands.backfill_niche_rag.django_rq.get_queue',
        return_value=fake_queue,
    ):
        call_command(
            'backfill_niche_rag',
            '--niche', str(ten_ideas[0].niche_id),
            '--content-type', 'slogan',
            '--budget', '100',
            stdout=out,
        )
    assert fake_queue.enqueue.call_count == 10
    assert 'rows to process   : 10' in out.getvalue()


@pytest.mark.django_db
def test_idempotent_default_does_not_force_reembed(ten_ideas):
    """Without --reembed-existing, force_reembed=False is passed."""
    fake_queue = MagicMock()
    out = StringIO()
    with patch(
        'vector_app.management.commands.backfill_niche_rag.django_rq.get_queue',
        return_value=fake_queue,
    ):
        call_command('backfill_niche_rag', '--content-type', 'slogan', '--budget', '100', stdout=out)
    reembed_args = [call.args[4] for call in fake_queue.enqueue.call_args_list]
    assert all(arg is False for arg in reembed_args)

"""PROJ-29 Phase 1B Round 3: schedule_index_maintenance management command."""

from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_command_registers_two_crons():
    """Running the command registers exactly 2 cron jobs."""
    fake_scheduler = MagicMock()
    fake_scheduler.get_jobs.return_value = []
    with patch('django_rq.get_scheduler', return_value=fake_scheduler):
        call_command('schedule_index_maintenance')

    assert fake_scheduler.cron.call_count == 2
    ids_passed = [call.kwargs.get('id') for call in fake_scheduler.cron.call_args_list]
    assert 'vector_app.maintain_indexes' in ids_passed
    assert 'vector_app.retry_failed_indexings' in ids_passed


@pytest.mark.django_db
def test_command_idempotent_cancels_existing():
    """Running twice cancels existing schedules before re-registering."""
    existing_job_maint = MagicMock()
    existing_job_maint.id = 'vector_app.maintain_indexes'
    existing_job_retry = MagicMock()
    existing_job_retry.id = 'vector_app.retry_failed_indexings'

    fake_scheduler = MagicMock()
    fake_scheduler.get_jobs.return_value = [existing_job_maint, existing_job_retry]
    with patch('django_rq.get_scheduler', return_value=fake_scheduler):
        call_command('schedule_index_maintenance')

    cancelled = [call.args[0] for call in fake_scheduler.cancel.call_args_list]
    assert existing_job_maint in cancelled
    assert existing_job_retry in cancelled
    assert fake_scheduler.cron.call_count == 2

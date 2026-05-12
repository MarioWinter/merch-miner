"""PROJ-29 Phase 1B Round 3: maintain_indexes + retry_failed_indexings."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.contenttypes.models import ContentType

from idea_app.models import Idea
from vector_app.models import IndexingFailure
from vector_app.tasks import (
    _discover_embedding_indexes,
    create_or_update_embedding,
    maintain_indexes,
    retry_failed_indexings,
)


@pytest.mark.django_db
def test_discover_embedding_indexes_returns_list():
    """Discovery returns at least the pgvector index name."""
    indexes = _discover_embedding_indexes()
    assert isinstance(indexes, list)


@pytest.mark.django_db
def test_maintain_indexes_runs_reindex_on_discovered_indexes():
    fake_cursor = MagicMock()
    fake_cursor.fetchall.side_effect = [
        [('idx_pgvector_test',), ('idx_search_vector_test',)],
        [('idx_pgvector_test', 100, 1), ('idx_search_vector_test', 99, 1)],
    ]
    fake_cursor.__enter__ = MagicMock(return_value=fake_cursor)
    fake_cursor.__exit__ = MagicMock(return_value=False)

    with patch('vector_app.tasks.connection.cursor', return_value=fake_cursor):
        count = maintain_indexes()
    assert count == 2

    executed_sql = ' '.join(
        call.args[0] for call in fake_cursor.execute.call_args_list
    ).upper()
    assert 'REINDEX INDEX CONCURRENTLY' in executed_sql


@pytest.mark.django_db
def test_maintain_indexes_no_indexes_returns_zero():
    fake_cursor = MagicMock()
    fake_cursor.fetchall.return_value = []
    fake_cursor.__enter__ = MagicMock(return_value=fake_cursor)
    fake_cursor.__exit__ = MagicMock(return_value=False)
    with patch('vector_app.tasks.connection.cursor', return_value=fake_cursor):
        count = maintain_indexes()
    assert count == 0


@pytest.mark.django_db
def test_retry_failed_indexings_enqueues_oldest_unresolved():
    idea_ct = ContentType.objects.get_for_model(Idea)
    older = IndexingFailure.objects.create(
        content_type=idea_ct, object_id='00000000-0000-0000-0000-000000000001',
        attempt_count=3, last_error='boom',
    )
    IndexingFailure.objects.create(
        content_type=idea_ct, object_id='00000000-0000-0000-0000-000000000002',
        attempt_count=3, last_error='boom',
    )

    fake_queue = MagicMock()
    with patch('vector_app.tasks.django_rq.get_queue', return_value=fake_queue):
        n = retry_failed_indexings()

    assert n == 2
    assert fake_queue.enqueue.call_count == 2
    enqueued_funcs = [call.args[0] for call in fake_queue.enqueue.call_args_list]
    assert all(fn is create_or_update_embedding for fn in enqueued_funcs)
    enqueued_object_ids = [str(call.args[2]) for call in fake_queue.enqueue.call_args_list]
    assert str(older.object_id) in enqueued_object_ids


@pytest.mark.django_db
def test_retry_failed_indexings_caps_at_one_hundred():
    idea_ct = ContentType.objects.get_for_model(Idea)
    for i in range(120):
        IndexingFailure.objects.create(
            content_type=idea_ct,
            object_id=f'00000000-0000-0000-0000-{i:012d}',
            attempt_count=3, last_error='boom',
        )

    fake_queue = MagicMock()
    with patch('vector_app.tasks.django_rq.get_queue', return_value=fake_queue):
        n = retry_failed_indexings()
    assert n == 100
    assert fake_queue.enqueue.call_count == 100


@pytest.mark.django_db
def test_retry_failed_indexings_skips_resolved():
    from django.utils import timezone
    idea_ct = ContentType.objects.get_for_model(Idea)
    IndexingFailure.objects.create(
        content_type=idea_ct, object_id='00000000-0000-0000-0000-000000000099',
        attempt_count=3, last_error='boom', resolved_at=timezone.now(),
    )

    fake_queue = MagicMock()
    with patch('vector_app.tasks.django_rq.get_queue', return_value=fake_queue):
        n = retry_failed_indexings()
    assert n == 0
    fake_queue.enqueue.assert_not_called()


@pytest.mark.django_db
def test_retry_resets_attempt_counter():
    """re-enqueue passes attempt=0 so the retry chain starts fresh."""
    idea_ct = ContentType.objects.get_for_model(Idea)
    IndexingFailure.objects.create(
        content_type=idea_ct, object_id='00000000-0000-0000-0000-000000000007',
        attempt_count=3, last_error='boom',
    )

    fake_queue = MagicMock()
    with patch('vector_app.tasks.django_rq.get_queue', return_value=fake_queue):
        retry_failed_indexings()
    enqueued_attempt_args = [call.args[3] for call in fake_queue.enqueue.call_args_list]
    assert all(arg == 0 for arg in enqueued_attempt_args)

"""PROJ-29 Phase 1G AC-Ops-RQ-4/5 — queue routing for chat-domain jobs.

Verifies ``summarize_conversation`` enqueues onto the ``agent`` RQ queue (not
``default``), so backfill storms on ``default`` cannot delay conversation
summarization or follow-ups.

The 100-dummy-jobs load test from the spec ("agent job completes <5s while
default queue is 100 deep") requires a live Redis worker and is deferred to
Phase 1I integration tests. This module verifies the queue contract via
introspection of the ``@django_rq.job`` decorator.
"""

from __future__ import annotations

import pytest


def _resolve_bound_queue(decorated_fn):
    """Walk ``decorated_fn.delay.__closure__`` to find the bound ``job``
    decorator instance + return its ``.queue`` attribute.

    ``@django_rq.job('agent', ...)`` ends up calling
    ``rq.decorators.job.__call__`` which closes over ``self`` (the decorator
    instance with ``.queue`` set). We surface ``.queue`` for assertions.
    """
    delay = getattr(decorated_fn, 'delay', None)
    if delay is None:
        return None
    cells = (delay.__closure__ or ())
    for cell in cells:
        try:
            value = cell.cell_contents
        except ValueError:  # empty cell
            continue
        if hasattr(value, 'queue'):
            return value.queue
    return None


def test_summarize_conversation_decorator_targets_agent_queue():
    """``@django_rq.job('agent', ...)`` on the task ensures ``.delay()`` routes
    to the ``agent`` queue, not ``default``.

    AC-Ops-RQ-4/5: chat-domain async work runs on ``agent`` so a 100-deep
    ``default`` backlog (e.g. embedding backfill storm) cannot block the
    conversation summarizer.
    """
    from agent_app.tasks import summarize_conversation

    queue = _resolve_bound_queue(summarize_conversation)
    assert queue is not None, (
        'summarize_conversation is not @django_rq.job-decorated — '
        'cannot resolve the bound queue.'
    )
    queue_name = getattr(queue, 'name', queue)
    assert queue_name == 'agent', (
        f'summarize_conversation bound to queue {queue_name!r}, expected "agent". '
        'Backfill storms on "default" must not delay chat summaries.'
    )


def test_summarize_conversation_not_routed_to_default_queue():
    """Explicit negative test — never the ``default`` queue.

    If a future refactor accidentally removes the @job decorator OR points it
    at ``default``, this test fails loudly. Pairs with AC-Ops-RQ-4 isolation.
    """
    from agent_app.tasks import summarize_conversation

    queue = _resolve_bound_queue(summarize_conversation)
    assert queue is not None
    queue_name = getattr(queue, 'name', queue)
    assert queue_name != 'default', (
        'summarize_conversation must NOT use the default queue — see '
        'AC-Ops-RQ-4/5 isolation contract.'
    )


def test_summarize_conversation_has_delay_helper():
    """``@django_rq.job`` exposes a ``.delay()`` helper for callers — verify
    the wrapper is present so call sites don't silently break on import.
    """
    from agent_app.tasks import summarize_conversation

    assert callable(getattr(summarize_conversation, 'delay', None)), (
        'summarize_conversation.delay missing — @django_rq.job decorator '
        'unwound? Callers expect .delay/.enqueue helpers.'
    )


@pytest.mark.django_db(transaction=True)
def test_summarize_conversation_callable_directly_still_works():
    """Sanity check — the @job decorator must not break direct invocation.

    Tests in `test_conversation_summarizer.py` already invoke the function
    synchronously; preserve that contract.
    """
    from agent_app.tasks import summarize_conversation

    # The function should still be directly callable (returns None when the
    # session row is missing, per existing log-and-skip behavior).
    result = summarize_conversation('00000000-0000-0000-0000-000000000000')
    assert result is None


def test_summarize_conversation_timeout_120s():
    """AC-Ops-RQ-4 — chat summarizer is a single LLM call; 120s timeout caps
    a hung OpenRouter call without aborting fast happy-paths.
    """
    from agent_app.tasks import summarize_conversation

    delay = summarize_conversation.delay
    for cell in (delay.__closure__ or ()):
        try:
            value = cell.cell_contents
        except ValueError:
            continue
        if hasattr(value, 'timeout'):
            assert value.timeout == 120, (
                f'summarize_conversation timeout={value.timeout}, expected 120s'
            )
            return
    pytest.fail('Could not introspect timeout on summarize_conversation decorator')

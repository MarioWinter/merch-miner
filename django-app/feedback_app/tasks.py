"""django-rq jobs for ``feedback_app``.

``send_feedback_email`` posts a plain-text notification email to
``FEEDBACK_RECIPIENT_EMAIL`` (defaults to Mario's address) every time a new
report row is created. The view enqueues this via ``.delay()`` AFTER the row
is persisted so the API can return 201 immediately (AC-1-7 + AC-1-8).
"""

import logging
import os

import django_rq
from django.conf import settings
from django.core.mail import EmailMessage

from feedback_app.models import BugFeatureReport

logger = logging.getLogger(__name__)


def _recipient_email() -> str:
    """Resolve recipient lazily so env changes (or test-time settings
    overrides) are picked up between jobs.

    Order of preference:
      1. ``settings.FEEDBACK_RECIPIENT_EMAIL`` — Django config; honors
         ``@override_settings`` in tests.
      2. ``FEEDBACK_RECIPIENT_EMAIL`` env var — for production restarts
         that change the recipient without restarting Django.
      3. ``settings.DEFAULT_FROM_EMAIL`` — fallback so the email at
         least goes somewhere identifiable.
    """
    return (
        getattr(settings, 'FEEDBACK_RECIPIENT_EMAIL', '')
        or os.environ.get('FEEDBACK_RECIPIENT_EMAIL', '')
        or getattr(settings, 'DEFAULT_FROM_EMAIL', '')
        or ''
    )


def _admin_url(report: BugFeatureReport) -> str:
    """Build a best-effort link to the Django admin change page for the
    report. We don't have a request here, so we fall back to the first
    ``ALLOWED_HOSTS`` entry."""
    host = (settings.ALLOWED_HOSTS or ['localhost'])[0]
    scheme = 'https' if not settings.DEBUG else 'http'
    return (
        f'{scheme}://{host}/admin/feedback_app/bugfeaturereport/'
        f'{report.id}/change/'
    )


def _build_email_body(report: BugFeatureReport) -> str:
    user_email = report.user.email if report.user else '(deleted user)'
    workspace_name = (
        report.workspace.name if report.workspace_id else '(no workspace)'
    )
    has_shot = 'yes' if report.screenshot_id else 'no'
    return (
        f'New {report.get_type_display()} report from {user_email}\n'
        f'Workspace: {workspace_name} ({report.workspace_id})\n'
        f'Submitted: {report.created_at.isoformat()}\n'
        f'Screenshot attached: {has_shot}\n'
        f'\n'
        f'Title: {report.title}\n'
        f'\n'
        f'Description:\n{report.description}\n'
        f'\n'
        f'Admin: {_admin_url(report)}\n'
    )


@django_rq.job('default', timeout=60, result_ttl=3600, failure_ttl=86400)
def send_feedback_email(report_id: str) -> None:
    """rq job: notify the configured recipient about a new feedback report.

    Behavior:
      * Loads the report row by id. If it's gone (deleted before the job
        ran), logs and exits cleanly — no retry needed.
      * Builds a plain-text body (XSS-safe per EC-1-7 — no HTML rendering).
      * Sends via ``django.core.mail.send_mail``. On failure the exception
        propagates so django-rq's worker can retry (max 3 attempts per the
        worker config). The report row is already saved either way (AC-1-8).
    """
    try:
        report = BugFeatureReport.objects.select_related(
            'workspace', 'user',
        ).get(id=report_id)
    except BugFeatureReport.DoesNotExist:
        logger.warning(
            'send_feedback_email: report %s not found, skipping.', report_id,
        )
        return

    recipient = _recipient_email()
    if not recipient:
        logger.warning(
            'send_feedback_email: FEEDBACK_RECIPIENT_EMAIL + DEFAULT_FROM_EMAIL '
            'both empty — cannot send.',
        )
        return

    subject = f'[Merch Miner Feedback] {report.get_type_display()}: {report.title}'
    body = _build_email_body(report)
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or recipient

    try:
        msg = EmailMessage(
            subject=subject,
            body=body,
            from_email=from_email,
            to=[recipient],
        )
        # AC-1-3: attach the screenshot file itself when present so the
        # recipient can see what the user reported without logging into
        # the admin. Mime + size were already validated server-side at
        # upload time (FeedbackScreenshotUploadSerializer).
        if report.screenshot_id and report.screenshot.image:
            try:
                msg.attach_file(report.screenshot.image.path)
            except (FileNotFoundError, ValueError):
                # Storage backend (e.g. cloud) may not expose .path, or
                # the file was deleted between enqueue and run — still
                # send the body so the report doesn't get lost.
                logger.warning(
                    'send_feedback_email: screenshot file unreachable for '
                    'report %s; sending body only.',
                    report_id,
                )
        msg.send(fail_silently=False)
    except Exception:
        # Log + re-raise so rq retries. AC-1-8: failure does NOT block the
        # API response — the report row is already in the DB by the time
        # this job runs.
        logger.warning(
            'send_feedback_email: SMTP send failed for report %s',
            report_id,
            exc_info=True,
        )
        raise

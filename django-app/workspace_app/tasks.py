import logging
import os

from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def send_invite_email_task(email: str, workspace_name: str, token: str) -> None:
    """
    django-rq task: send workspace invite email with a signed accept link.

    Token is produced by django.core.signing.dumps() and has max_age=172800 (48 h).
    """
    frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
    accept_url = f"{frontend_url}/workspaces/invite/accept/?token={token}"

    subject = f"You've been invited to join {workspace_name} on Merch Miner"

    # Plain-text body (fallback)
    text_body = (
        f"You have been invited to join the workspace \"{workspace_name}\" on Merch Miner.\n\n"
        f"Accept your invitation (valid for 48 hours):\n{accept_url}\n\n"
        "If you did not expect this email, you can safely ignore it."
    )

    # HTML body — rendered from template if available, otherwise inline
    try:
        html_body = render_to_string(
            'workspace_app/invite_email.html',
            {'workspace_name': workspace_name, 'accept_url': accept_url},
        )
    except Exception:
        html_body = (
            f"<p>You have been invited to join <strong>{workspace_name}</strong> on Merch Miner.</p>"
            f"<p><a href=\"{accept_url}\">Accept invitation</a> (valid for 48 hours)</p>"
            "<p>If you did not expect this email, you can safely ignore it.</p>"
        )

    from_email = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@merchminer.com')

    try:
        send_mail(
            subject=subject,
            message=text_body,
            from_email=from_email,
            recipient_list=[email],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info("Invite email sent to %s for workspace '%s'", email, workspace_name)
    except Exception as exc:
        logger.error(
            "Failed to send invite email to %s for workspace '%s': %s",
            email, workspace_name, exc,
        )
        raise

"""User profile dialectic service — AC-70 (Phase 14, Metis Pattern).

Implements the 3-pass dialectic:
    1. Initial assessment of the user from session messages.
    2. Self-audit — what evidence did I miss?
    3. Reconciliation against the existing profile (EC-20: contradiction →
       prefer newer evidence; preserve older invariants).

The actual LLM call is delegated to a small helper that callers can
mock in tests. The default implementation builds a tiny ChatOpenAI
client via ``agent_app.agents.llm.get_llm_for_agent`` so the dialectic
benefits from per-workspace agent personality.
"""

from __future__ import annotations

import logging
from typing import Optional

from django.db import transaction
from django.utils import timezone

from agent_app.models import (
    AgentMessage,
    AgentSession,
    UserProfile,
)

logger = logging.getLogger(__name__)


PROFILE_DEFAULT_LIMIT = 1375


def _truncate(text: str, limit: int) -> str:
    if not text:
        return ''
    if len(text) <= limit:
        return text
    return text[:limit].rstrip()


def _gather_user_signals(session: AgentSession, max_messages: int = 50) -> str:
    """Pull a compact text blob of user-authored messages from a session."""
    qs = AgentMessage.objects.filter(
        session=session,
        role__in=['user', 'approval_response'],
    ).order_by('-created_at')[:max_messages]
    parts = [m.content for m in qs if m.content]
    return '\n'.join(reversed(parts))[:6000]


def _llm_dialectic_pass(
    workspace,
    user,
    pass_label: str,
    prior_text: str,
    user_signals: str,
    current_profile_md: str,
) -> str:
    """Run a single dialectic pass via the per-workspace LLM.

    This is intentionally thin and easy to mock in tests via
    ``unittest.mock.patch`` on this symbol.

    Returns the LLM-produced text. On any failure (no API key, network),
    returns ``prior_text`` unchanged so the dialectic gracefully degrades
    rather than blowing up the reflection job.
    """
    try:
        from agent_app.agents.llm import get_llm_for_agent
        from langchain_core.messages import HumanMessage, SystemMessage

        llm, _ = get_llm_for_agent(workspace, 'orchestrator')

        instructions = {
            'initial': (
                'You are building an initial profile for a single user. '
                'From the user signals, infer: communication style, '
                'autonomy preference, domain expertise, recurring asks. '
                'Produce concise Markdown bullets, max ~250 words.'
            ),
            'audit': (
                'You wrote a draft user profile. Self-audit: what evidence '
                'is missing or contradictory? What inferences are too '
                'aggressive? Output a corrected Markdown profile, max ~250 words.'
            ),
            'reconcile': (
                'Compare the new draft with the EXISTING profile. Where '
                'they conflict, prefer the newer evidence but explicitly '
                'preserve older invariants if the new evidence is weak. '
                'Output a single coherent Markdown profile, max ~250 words.'
            ),
        }.get(pass_label, 'Refine the user profile.')

        system = SystemMessage(content=instructions)
        prompt = (
            f"Existing profile:\n{current_profile_md or '(none)'}\n\n"
            f"User signals (most-recent last):\n{user_signals or '(none)'}\n\n"
            f"Prior draft for this dialectic:\n{prior_text or '(none)'}"
        )
        result = llm.invoke([system, HumanMessage(content=prompt)])
        content = getattr(result, 'content', '') or ''
        return content if isinstance(content, str) else str(content)
    except Exception as exc:  # pragma: no cover — defensive
        logger.warning('dialectic LLM call failed (%s); returning prior text', exc)
        return prior_text


def get_or_create_profile(workspace, user) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(
        workspace=workspace,
        user=user,
    )
    return profile


def should_run_dialectic(profile: UserProfile, sessions_since_last: int) -> bool:
    cadence = max(1, int(profile.dialect_cadence_sessions or 1))
    return sessions_since_last >= cadence


def run_dialectic(
    workspace,
    user,
    session_id: Optional[str] = None,
) -> UserProfile:
    """AC-70 — 3-pass dialectic that updates the user's profile.

    Steps:
        1. Initial assessment from recent user signals.
        2. Self-audit for gaps + over-aggressive inferences.
        3. Reconciliation against existing ``content_md`` (EC-20).

    The full chain of pass outputs is appended to ``dialect_reasoning``
    so the user can see WHY the agent inferred what it did.
    """
    profile = get_or_create_profile(workspace, user)

    # Resolve char-limit from AgentWorkspaceConfig (singleton).
    limit = PROFILE_DEFAULT_LIMIT
    try:
        from agent_app.models import AgentWorkspaceConfig
        cfg = AgentWorkspaceConfig.objects.filter(workspace=workspace).first()
        if cfg:
            limit = cfg.profile_char_limit
    except Exception:
        pass

    session = None
    if session_id:
        session = AgentSession.objects.filter(pk=session_id).first()

    user_signals = _gather_user_signals(session) if session else ''
    current_md = profile.content_md or ''

    initial = _llm_dialectic_pass(
        workspace, user, 'initial',
        prior_text='',
        user_signals=user_signals,
        current_profile_md=current_md,
    )
    audited = _llm_dialectic_pass(
        workspace, user, 'audit',
        prior_text=initial,
        user_signals=user_signals,
        current_profile_md=current_md,
    )
    reconciled = _llm_dialectic_pass(
        workspace, user, 'reconcile',
        prior_text=audited,
        user_signals=user_signals,
        current_profile_md=current_md,
    )

    final_md = _truncate(reconciled or audited or current_md, limit)

    reasoning_blob = (
        f"## Pass 1 — Initial\n{initial}\n\n"
        f"## Pass 2 — Audit\n{audited}\n\n"
        f"## Pass 3 — Reconciled\n{reconciled}"
    )[:8000]  # Keep scratchpad bounded — not LLM-context-loaded.

    with transaction.atomic():
        profile.content_md = final_md
        profile.dialect_reasoning = reasoning_blob
        profile.last_dialectic_at = timezone.now()
        # Validators ensure max_length is respected; full_clean to surface
        # contract violations as ValidationError for tests.
        profile.full_clean(exclude=['user', 'workspace'])
        profile.save(
            update_fields=[
                'content_md', 'dialect_reasoning',
                'last_dialectic_at', 'updated_at',
            ],
        )
    return profile


__all__ = [
    'PROFILE_DEFAULT_LIMIT',
    'run_dialectic',
    'get_or_create_profile',
    'should_run_dialectic',
]

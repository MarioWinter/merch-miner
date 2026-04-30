import logging
import uuid

import django_rq
from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from agent_app.constants import DEFAULT_TOOL_PERMISSIONS
from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentConfig,
    AgentMessage,
    AgentSession,
    AgentType,
    AgentWorkspaceConfig,
    AutonomyPreset,
    KnowledgeDoc,
    MessageRole,
    SessionSource,
    SessionStatus,
    Skill,
    SkillTriggerType,
    SkillVersion,
    ToolPermission,
    UserProfile,
    WorkflowTemplate,
    WorkspaceMemory,
)
from agent_app.api.serializers import (
    AgentActionLogSerializer,
    AgentConfigAdminUpdateSerializer,
    AgentConfigSerializer,
    AgentConfigUpdateSerializer,
    AgentMessageSerializer,
    AgentSessionCreateSerializer,
    AgentSessionDetailSerializer,
    AgentSessionListSerializer,
    AutonomyPresetSerializer,
    BatchSessionCreateSerializer,
    KnowledgeDocCreateSerializer,
    KnowledgeDocSerializer,
    SendMessageSerializer,
    ToolPermissionBulkUpdateSerializer,
    ToolPermissionSerializer,
    WorkflowTemplateCreateSerializer,
    WorkflowTemplateSerializer,
)
from agent_app.services.collision_detector import check_niche_collision
from agent_app.tasks import resume_agent_workflow, run_agent_workflow
from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

logger = logging.getLogger(__name__)


# ── Helpers ──

class AgentPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class MessagePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _get_workspace(user):
    """Return the user's first active workspace membership."""
    membership = Membership.objects.filter(
        user=user, status='active',
    ).select_related('workspace').first()
    if not membership:
        return None
    return membership.workspace


def _ensure_defaults(workspace):
    """Ensure agent configs, presets, and templates exist for workspace (lazy seed)."""
    from agent_app.models import AGENT_DEFAULTS
    from agent_app.constants import SYSTEM_PRESETS, SYSTEM_TEMPLATES

    # Seed configs
    existing_types = set(
        AgentConfig.objects.filter(workspace=workspace).values_list('agent_type', flat=True)
    )
    configs_to_create = []
    for agent_type in AgentType.values:
        if agent_type not in existing_types:
            defaults = AGENT_DEFAULTS.get(agent_type, {})
            configs_to_create.append(AgentConfig(
                workspace=workspace,
                agent_type=agent_type,
                display_name=defaults.get('display_name', agent_type.title()),
                avatar_emoji=defaults.get('avatar_emoji', '\U0001f916'),
                model_name=defaults.get('model_name', 'openai/gpt-4.1-mini'),
                temperature=defaults.get('temperature', 0.3),
            ))
    if configs_to_create:
        AgentConfig.objects.bulk_create(configs_to_create, ignore_conflicts=True)

    # Seed presets
    existing_presets = set(
        AutonomyPreset.objects.filter(workspace=workspace, is_system=True).values_list('name', flat=True)
    )
    presets_to_create = []
    for preset_data in SYSTEM_PRESETS:
        if preset_data['name'] not in existing_presets:
            presets_to_create.append(AutonomyPreset(
                workspace=workspace,
                name=preset_data['name'],
                is_system=True,
                permissions=preset_data['permissions'],
            ))
    if presets_to_create:
        AutonomyPreset.objects.bulk_create(presets_to_create, ignore_conflicts=True)

    # Seed templates
    existing_keys = set(
        WorkflowTemplate.objects.filter(workspace=workspace, is_system=True).values_list('key', flat=True)
    )
    templates_to_create = []
    for tmpl_data in SYSTEM_TEMPLATES:
        if tmpl_data['key'] not in existing_keys:
            templates_to_create.append(WorkflowTemplate(
                workspace=workspace,
                name=tmpl_data['name'],
                key=tmpl_data['key'],
                is_system=True,
                steps=tmpl_data['steps'],
            ))
    if templates_to_create:
        WorkflowTemplate.objects.bulk_create(templates_to_create, ignore_conflicts=True)


# ══════════════════════════════════════════
#  Session CRUD + Controls
# ══════════════════════════════════════════

class AgentSessionListCreateView(APIView):
    """GET: list sessions. POST: create session (AC-48)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        qs = AgentSession.objects.filter(workspace=workspace).annotate(
            _message_count=Count('messages'),
        ).select_related('created_by', 'niche_context')

        # Filter: own sessions + shared sessions
        qs = qs.filter(
            **({'created_by': request.user} if not request.query_params.get('shared') else {}),
        )
        if request.query_params.get('shared'):
            qs = qs.filter(is_shared=True)

        if request.query_params.get('status'):
            qs = qs.filter(status=request.query_params['status'])

        # AC-33: batch progress visible — filter by batch_id so the Agent-Tab
        # can fetch all sibling sessions of a single batch in one round-trip.
        batch_id_param = request.query_params.get('batch_id')
        if batch_id_param:
            try:
                batch_uuid = uuid.UUID(batch_id_param)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'Invalid batch_id (must be a UUID)'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = qs.filter(batch_id=batch_uuid).order_by(
                'batch_position', 'created_at',
            )
        else:
            # Stable ordering for non-batch listings (newest first).
            qs = qs.order_by('-created_at')

        paginator = AgentPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AgentSessionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        _ensure_defaults(workspace)

        serializer = AgentSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        niche = None
        if data.get('niche_context'):
            from niche_app.models import Niche
            niche = get_object_or_404(Niche, id=data['niche_context'], workspace=workspace)

        # Collision detection (AC-34/35) — pause flow.
        # When a collision is detected, the new session is created but
        # immediately paused with a system warning message. The caller can
        # bypass with ``?override=true`` to skip the pause and let the
        # workflow run regardless.
        override = request.query_params.get('override', '').lower() in ('1', 'true', 'yes')
        collisions = check_niche_collision(workspace, niche)

        # Auto-generate title
        title = data.get('title', '')
        if not title:
            tmpl = data.get('workflow_template', '')
            niche_name = niche.name if niche else 'General'
            title = f"{tmpl or 'Agent'}: {niche_name}"

        # Resolve total steps from template
        total_steps = 0
        template_key = data.get('workflow_template', '')
        if template_key:
            tmpl_obj = WorkflowTemplate.objects.filter(
                workspace=workspace, key=template_key,
            ).first()
            if not tmpl_obj:
                # Reject silently-bogus template keys explicitly (no fallback
                # to "autonomous" — the caller asked for a specific template).
                return Response(
                    {
                        'error': f"Unknown workflow_template '{template_key}'",
                        'workflow_template': template_key,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            total_steps = len(tmpl_obj.steps)

        session = AgentSession.objects.create(
            workspace=workspace,
            created_by=request.user,
            title=title[:200],
            niche_context=niche,
            workflow_template=template_key,
            autonomy_preset=data.get('autonomy_preset', 'assisted'),
            total_steps=total_steps,
        )

        # Collision flow (AC-35): pause with warning; only enqueue if no
        # collision OR caller passed ``?override=true`` to ignore.
        if collisions and not override:
            from agent_app.services.collision_detector import warn_and_pause
            warn_and_pause(session, collisions)
            session.refresh_from_db()
            resp = AgentSessionDetailSerializer(session).data
            resp['collisions'] = collisions
            return Response(resp, status=status.HTTP_201_CREATED)

        # Enqueue workflow
        queue = django_rq.get_queue('agent')
        queue.enqueue(run_agent_workflow, str(session.id))

        resp = AgentSessionDetailSerializer(session).data
        if collisions:
            resp['collisions'] = collisions
        return Response(resp, status=status.HTTP_201_CREATED)


class BatchSessionCreateView(APIView):
    """POST: batch start sessions for multiple niches (AC-31, AC-32, AC-33).

    Body:
        {
            "niche_ids": [<uuid>, ...]  # 1..50, all must belong to workspace
            "workflow_template": "<key>"  # optional template key
            "parallel": false             # default sequential
            "autonomy_preset": "assisted" # optional, propagated to each session
        }

    Returns:
        {
            "batch_id": <uuid>,           # shared identifier across siblings
            "session_ids": [<uuid>, ...], # ordered by batch_position
            "sessions": [...],            # AgentSessionListSerializer payload
            "status": "queued",
            "parallel": <bool>,
        }

    Sequential mode (AC-32 default): only the first session is enqueued
    immediately. When that session completes, `enqueue_next_in_batch()` is
    called from `run_agent_workflow` to chain the next IDLE sibling.

    Parallel mode: every session is enqueued at creation time as a
    separate `agent`-queue job.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        _ensure_defaults(workspace)

        serializer = BatchSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from niche_app.models import Niche

        niche_ids = data['niche_ids']
        niches_qs = Niche.objects.filter(
            id__in=niche_ids, workspace=workspace,
        )
        # Reject cross-workspace or unknown niche_ids (AC-31 isolation).
        found_ids = {n.id for n in niches_qs}
        missing = [str(nid) for nid in niche_ids if nid not in found_ids]
        if missing:
            return Response(
                {
                    'error': 'Some niche IDs not found in workspace',
                    'missing_niche_ids': missing,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Preserve caller-supplied order for deterministic batch_position.
        niche_by_id = {n.id: n for n in niches_qs}
        ordered_niches = [niche_by_id[nid] for nid in niche_ids]

        template_key = data.get('workflow_template', '')
        total_steps = 0
        if template_key:
            tmpl_obj = WorkflowTemplate.objects.filter(
                workspace=workspace, key=template_key,
            ).first()
            if tmpl_obj:
                total_steps = len(tmpl_obj.steps)

        autonomy_preset = data.get('autonomy_preset') or 'assisted'

        # AC-31: shared batch_id across siblings.
        batch_id = uuid.uuid4()

        sessions = []
        for position, niche in enumerate(ordered_niches):
            session = AgentSession.objects.create(
                workspace=workspace,
                created_by=request.user,
                title=f"{template_key or 'Batch'}: {niche.name}"[:200],
                niche_context=niche,
                workflow_template=template_key,
                autonomy_preset=autonomy_preset,
                source=SessionSource.BATCH_API,
                batch_id=batch_id,
                batch_position=position,
                total_steps=total_steps,
            )
            sessions.append(session)

        queue = django_rq.get_queue('agent')

        if data.get('parallel'):
            # AC-32: parallel — every session enqueued immediately.
            for s in sessions:
                queue.enqueue(run_agent_workflow, str(s.id))
        else:
            # AC-32: sequential — only the first session is enqueued.
            # Subsequent siblings are chained by `enqueue_next_in_batch`
            # when the previous one finishes (run_agent_workflow tail).
            if sessions:
                queue.enqueue(run_agent_workflow, str(sessions[0].id))

        return Response(
            {
                'batch_id': str(batch_id),
                'session_ids': [str(s.id) for s in sessions],
                'sessions': AgentSessionListSerializer(sessions, many=True).data,
                'parallel': bool(data.get('parallel')),
                'status': 'queued',
            },
            status=status.HTTP_201_CREATED,
        )


class AgentSessionDetailView(APIView):
    """GET: session detail + messages + progress (AC-48)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        # Privacy: only owner OR shared sessions are visible to other workspace
        # members. Workspace member B must NOT be able to read member A's
        # private session by guessing the UUID.
        session = get_object_or_404(
            AgentSession.objects.select_related('created_by', 'niche_context').filter(
                Q(created_by=request.user) | Q(is_shared=True),
            ),
            id=session_id, workspace=workspace,
        )

        # Build agent config lookup for message display names
        configs = {
            c.agent_type: c
            for c in AgentConfig.objects.filter(workspace=workspace)
        }

        # Paginate messages (EC-10: latest 50)
        messages_qs = session.messages.order_by('-created_at')
        msg_paginator = MessagePagination()
        msg_page = msg_paginator.paginate_queryset(messages_qs, request)
        msg_serializer = AgentMessageSerializer(
            msg_page, many=True, context={'agent_configs': configs},
        )

        # Action logs (recent)
        action_logs = session.action_logs.order_by('-created_at')[:20]

        data = AgentSessionDetailSerializer(session).data
        data['messages'] = msg_serializer.data
        data['messages_pagination'] = {
            'count': msg_paginator.page.paginator.count,
            'next': msg_paginator.get_next_link(),
            'previous': msg_paginator.get_previous_link(),
        }
        data['action_logs'] = AgentActionLogSerializer(action_logs, many=True).data
        return Response(data)


class AgentSessionMessageView(APIView):
    """POST: send command to agent (AC-48 + EC-12)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(
            AgentSession, id=session_id, workspace=workspace, created_by=request.user,
        )

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data['content']

        # EC-12: when session is RUNNING (a tool is in flight), persist
        # the message as processed=False — orchestrator will drain it
        # between sub-agent delegations without interrupting the active tool.
        if session.status == SessionStatus.RUNNING:
            from agent_app.services.message_queue import enqueue_user_message
            msg = enqueue_user_message(session, content)
            return Response(
                AgentMessageSerializer(msg).data,
                status=status.HTTP_201_CREATED,
            )

        # Idle/Paused: persist + (re)start the worker if needed
        msg = AgentMessage.objects.create(
            session=session,
            role=MessageRole.USER,
            content=content,
            processed=True,
        )
        if session.status in (SessionStatus.IDLE, SessionStatus.PAUSED):
            session.status = SessionStatus.RUNNING
            session.save(update_fields=['status', 'updated_at'])
            queue = django_rq.get_queue('agent')
            queue.enqueue(run_agent_workflow, str(session.id))

        return Response(AgentMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


def _get_owned_session(request, session_id, workspace):
    """Resolve a session that is owned by the request.user (write actions).

    Workspace-scoped + ownership-scoped lookup — non-owner attempts to mutate
    a session (pause/resume/stop/share/approve/reject) get a 404 to avoid
    leaking the existence of someone else's session. Use ``_get_visible_session``
    for read-only paths that may include shared sessions.
    """
    return get_object_or_404(
        AgentSession, id=session_id, workspace=workspace, created_by=request.user,
    )


class AgentSessionPauseView(APIView):
    """POST: pause running session (AC-40)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        if session.status != SessionStatus.RUNNING:
            return Response({'error': 'Session not running'}, status=status.HTTP_400_BAD_REQUEST)
        session.status = SessionStatus.PAUSED
        session.save(update_fields=['status', 'updated_at'])
        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionResumeView(APIView):
    """POST: resume paused session (AC-41)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        if session.status != SessionStatus.PAUSED:
            return Response({'error': 'Session not paused'}, status=status.HTTP_400_BAD_REQUEST)
        session.status = SessionStatus.RUNNING
        session.save(update_fields=['status', 'updated_at'])
        queue = django_rq.get_queue('agent')
        queue.enqueue(resume_agent_workflow, str(session.id))
        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionStopView(APIView):
    """POST: stop running/paused session (AC-42)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
            return Response({'error': 'Session not active'}, status=status.HTTP_400_BAD_REQUEST)
        session.status = SessionStatus.CANCELLED
        session.save(update_fields=['status', 'updated_at'])
        AgentMessage.objects.create(
            session=session,
            role=MessageRole.SYSTEM,
            content='Workflow stopped by user.',
        )
        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionShareView(APIView):
    """POST: share session (AC-60). Owner-only.

    Toggles ``is_shared=True`` — workspace-wide visibility (no shareable URL
    in MVP, per AC-60 — every active workspace member can see shared
    sessions read-only via the existing list endpoint).
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        session.is_shared = True
        session.save(update_fields=['is_shared', 'updated_at'])
        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionUnshareView(APIView):
    """POST: unshare session (AC-60). Owner-only."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        session.is_shared = False
        session.save(update_fields=['is_shared', 'updated_at'])
        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionApproveView(APIView):
    """POST: approve a pending action (AC-22/23). Owner-only.

    Shared sessions are read-only for non-owners (AC-61) — only the
    session creator can resolve approvals. After approving, if the session
    was paused waiting on this approval, it is resumed via the agent queue
    so the orchestrator picks up from the PostgreSQL Checkpointer.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id, action_log_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        action_log = get_object_or_404(
            AgentActionLog, id=action_log_id, session=session,
            status=ActionStatus.AWAITING_APPROVAL,
        )
        from agent_app.services.permission_checker import resolve_approval
        resolve_approval(action_log, approved=True)
        # Resume if the session paused for this approval.
        if session.status == SessionStatus.PAUSED:
            session.status = SessionStatus.RUNNING
            session.save(update_fields=['status', 'updated_at'])
            queue = django_rq.get_queue('agent')
            queue.enqueue(resume_agent_workflow, str(session.id))
        return Response(AgentActionLogSerializer(action_log).data)


class AgentSessionRejectView(APIView):
    """POST: reject a pending action (AC-22/23). Owner-only.

    Marks the action_log as rejected and emits an approval_response message.
    The orchestrator picks up the rejection on resume via Checkpointer, skips
    the rejected tool, and continues. Session is re-enqueued so progress
    isn't blocked.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id, action_log_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        session = _get_owned_session(request, session_id, workspace)
        action_log = get_object_or_404(
            AgentActionLog, id=action_log_id, session=session,
            status=ActionStatus.AWAITING_APPROVAL,
        )
        from agent_app.services.permission_checker import resolve_approval
        resolve_approval(action_log, approved=False)
        # Resume so orchestrator can skip the rejected tool and continue.
        if session.status == SessionStatus.PAUSED:
            session.status = SessionStatus.RUNNING
            session.save(update_fields=['status', 'updated_at'])
            queue = django_rq.get_queue('agent')
            queue.enqueue(resume_agent_workflow, str(session.id))
        return Response(AgentActionLogSerializer(action_log).data)


# ══════════════════════════════════════════
#  Config
# ══════════════════════════════════════════

class AgentConfigListView(APIView):
    """GET: list all agent configs for workspace."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        _ensure_defaults(workspace)
        configs = AgentConfig.objects.filter(workspace=workspace).order_by('agent_type')
        return Response(AgentConfigSerializer(configs, many=True).data)


class AgentConfigUpdateView(APIView):
    """PATCH: update agent config (AC-55b)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, agent_type):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        if agent_type not in AgentType.values:
            return Response({'error': 'Invalid agent type'}, status=status.HTTP_400_BAD_REQUEST)

        config = get_object_or_404(AgentConfig, workspace=workspace, agent_type=agent_type)

        # Check if user is admin (for system_prompt editing)
        membership = Membership.objects.filter(
            user=request.user, workspace=workspace, status='active',
        ).first()
        is_admin = membership and membership.role == 'admin'

        SerializerClass = AgentConfigAdminUpdateSerializer if is_admin else AgentConfigUpdateSerializer
        serializer = SerializerClass(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AgentConfigSerializer(config).data)


# ══════════════════════════════════════════
#  Permissions
# ══════════════════════════════════════════

class ToolPermissionListView(APIView):
    """GET: list user's tool permissions. PATCH: bulk update (AC-20)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        # Seed defaults if none exist (AC-19) — atomic to avoid partial seeds
        # under concurrent requests/race conditions.
        existing = ToolPermission.objects.filter(workspace=workspace, user=request.user)
        if not existing.exists():
            perms_to_create = [
                ToolPermission(
                    workspace=workspace,
                    user=request.user,
                    tool_name=tool,
                    permission_level=level,
                )
                for tool, level in DEFAULT_TOOL_PERMISSIONS.items()
            ]
            with transaction.atomic():
                ToolPermission.objects.bulk_create(perms_to_create, ignore_conflicts=True)
            existing = ToolPermission.objects.filter(workspace=workspace, user=request.user)

        return Response(ToolPermissionSerializer(existing.order_by('tool_name'), many=True).data)

    def patch(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ToolPermissionBulkUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        permissions = serializer.validated_data['permissions']
        for tool_name, level in permissions.items():
            ToolPermission.objects.update_or_create(
                workspace=workspace,
                user=request.user,
                tool_name=tool_name,
                defaults={'permission_level': level},
            )

        updated = ToolPermission.objects.filter(
            workspace=workspace, user=request.user,
        ).order_by('tool_name')
        return Response(ToolPermissionSerializer(updated, many=True).data)


# ══════════════════════════════════════════
#  Presets
# ══════════════════════════════════════════

class AutonomyPresetListCreateView(APIView):
    """GET: list presets. POST: create custom preset."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        _ensure_defaults(workspace)
        presets = AutonomyPreset.objects.filter(workspace=workspace)
        return Response(AutonomyPresetSerializer(presets, many=True).data)

    def post(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AutonomyPresetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        preset = serializer.save(
            workspace=workspace,
            created_by=request.user,
            is_system=False,
        )
        return Response(AutonomyPresetSerializer(preset).data, status=status.HTTP_201_CREATED)


class AutonomyPresetActivateView(APIView):
    """POST: activate preset — bulk-update permissions (AC-21)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, preset_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        preset = get_object_or_404(AutonomyPreset, id=preset_id, workspace=workspace)

        for tool_name, level in preset.permissions.items():
            ToolPermission.objects.update_or_create(
                workspace=workspace,
                user=request.user,
                tool_name=tool_name,
                defaults={'permission_level': level},
            )

        return Response({'detail': f'Preset "{preset.name}" activated.'})


class AutonomyPresetDeleteView(APIView):
    """DELETE: delete custom preset (system presets not deletable)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, preset_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        preset = get_object_or_404(AutonomyPreset, id=preset_id, workspace=workspace)
        if preset.is_system:
            return Response({'error': 'Cannot delete system presets'}, status=status.HTTP_400_BAD_REQUEST)

        preset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════
#  Templates
# ══════════════════════════════════════════

class WorkflowTemplateListCreateView(APIView):
    """GET: list templates. POST: create custom template (AC-25)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        _ensure_defaults(workspace)
        templates = WorkflowTemplate.objects.filter(workspace=workspace)
        return Response(WorkflowTemplateSerializer(templates, many=True).data)

    def post(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        serializer = WorkflowTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Check key uniqueness in workspace
        if WorkflowTemplate.objects.filter(workspace=workspace, key=data['key']).exists():
            return Response(
                {'error': f"Template key '{data['key']}' already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = WorkflowTemplate.objects.create(
            workspace=workspace,
            created_by=request.user,
            name=data['name'],
            key=data['key'],
            is_system=False,
            steps=data['steps'],
        )
        return Response(WorkflowTemplateSerializer(template).data, status=status.HTTP_201_CREATED)


class WorkflowTemplateDeleteView(APIView):
    """DELETE: delete custom template (system templates not deletable)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, template_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        template = get_object_or_404(WorkflowTemplate, id=template_id, workspace=workspace)
        if template.is_system:
            return Response({'error': 'Cannot delete system templates'}, status=status.HTTP_400_BAD_REQUEST)

        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════
#  Knowledge Docs
# ══════════════════════════════════════════

class KnowledgeDocListCreateView(APIView):
    """GET: list docs. POST: create doc (AC-28)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        docs = KnowledgeDoc.objects.filter(workspace=workspace).order_by('-created_at')
        paginator = AgentPagination()
        page = paginator.paginate_queryset(docs, request)
        return paginator.get_paginated_response(KnowledgeDocSerializer(page, many=True).data)

    def post(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        serializer = KnowledgeDocCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        doc = serializer.save(
            workspace=workspace,
            created_by=request.user,
            source=KnowledgeDoc.Source.MANUAL,
        )
        return Response(KnowledgeDocSerializer(doc).data, status=status.HTTP_201_CREATED)


class KnowledgeDocDetailView(APIView):
    """PATCH: update. DELETE: delete (+ removes embedding via signal)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, doc_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        doc = get_object_or_404(KnowledgeDoc, id=doc_id, workspace=workspace)
        serializer = KnowledgeDocCreateSerializer(doc, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(KnowledgeDocSerializer(doc).data)

    def delete(self, request, doc_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        doc = get_object_or_404(KnowledgeDoc, id=doc_id, workspace=workspace)
        doc.delete()  # post_delete signal removes embedding (EC-9)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════
#  Dashboard Summary (PROJ-18 AC-63)
# ══════════════════════════════════════════

class AgentDashboardSummaryView(APIView):
    """GET /api/agent/dashboard/summary/ — workspace-scoped agent activity summary.

    Returns active session count, last completed session, weekly action count,
    and 30-day budget percentage. Cached 60s in Redis (TTL-only — see
    services/dashboard_summary.py for rationale).
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    CACHE_TTL_SECONDS = 60

    def get(self, request):
        from django.core.cache import cache

        from agent_app.api.serializers import AgentDashboardSummarySerializer
        from agent_app.services.dashboard_summary import (
            get_agent_dashboard_summary,
        )

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response(
                {'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN,
            )

        cache_key = f'agent:dashboard:ws:{workspace.pk}'
        data = cache.get(cache_key)
        if data is None:
            data = get_agent_dashboard_summary(workspace)
            cache.set(cache_key, data, self.CACHE_TTL_SECONDS)

        serializer = AgentDashboardSummarySerializer(data)
        return Response(serializer.data)


# ══════════════════════════════════════════
#  Phase 14 — Self-Improvement Layer (Metis Pattern)
# ══════════════════════════════════════════


def _is_workspace_admin(user, workspace) -> bool:
    """True if ``user`` is an active admin of ``workspace``."""
    return Membership.objects.filter(
        user=user, workspace=workspace, status='active', role='admin',
    ).exists()


def _ensure_workspace_config(workspace) -> AgentWorkspaceConfig:
    cfg, _ = AgentWorkspaceConfig.objects.get_or_create(workspace=workspace)
    return cfg


# ── Skills ──

class SkillsListCreateView(APIView):
    """GET list workspace skills + filters. POST manual create (admin)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        from agent_app.api.serializers import SkillSerializer

        qs = Skill.objects.filter(workspace=workspace)
        if request.query_params.get('include_deleted', '').lower() not in (
            '1', 'true', 'yes',
        ):
            qs = qs.filter(deleted_at__isnull=True)

        agent_type = request.query_params.get('agent_type')
        if agent_type:
            if agent_type not in AgentType.values:
                return Response(
                    {
                        'error': 'invalid_agent_type',
                        'detail': (
                            f"Unknown agent_type '{agent_type}'. "
                            f"Valid values: {sorted(AgentType.values)}."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # JSON contains lookup — works on PG.
            qs = qs.filter(applicable_agent_types__contains=[agent_type])

        trigger = request.query_params.get('trigger_type')
        if trigger:
            qs = qs.filter(trigger_type=trigger)

        # P2 #1 — N+1 fix: annotate version_count once on the queryset.
        qs = qs.annotate(_version_count=Count('versions')).order_by('-updated_at')
        paginator = AgentPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            SkillSerializer(page, many=True).data,
        )

    def post(self, request):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        if not _is_workspace_admin(request.user, workspace):
            return Response(
                {'error': 'Only workspace admins can create manual skills.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        from agent_app.api.serializers import SkillCreateSerializer, SkillSerializer
        from agent_app.services.skill_manager import create_skill

        serializer = SkillCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        skill = create_skill(
            workspace=workspace,
            name=data['name'],
            description=data.get('description', ''),
            content_md=data['content_md'],
            trigger_type=SkillTriggerType.MANUAL,
            applicable_agent_types=data.get('applicable_agent_types') or [],
            created_by=request.user,
            patch_summary=data.get('patch_summary', '') or 'Manual create',
        )
        return Response(
            SkillSerializer(skill).data, status=status.HTTP_201_CREATED,
        )


class SkillDetailView(APIView):
    """GET detail. PATCH (optimistic-concurrency). DELETE (soft)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_skill(self, request, skill_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return None, None, Response(
                {'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN,
            )
        # P2 #4 — soft-deleted skills are 404 by default. Pass
        # ``?include_deleted=true`` to surface them (audit / restore UI).
        qs = Skill.objects.filter(id=skill_id, workspace=workspace)
        if request.query_params.get('include_deleted', '').lower() not in (
            '1', 'true', 'yes',
        ):
            qs = qs.filter(deleted_at__isnull=True)
        skill = get_object_or_404(qs)
        return workspace, skill, None

    def get(self, request, skill_id):
        from agent_app.api.serializers import SkillSerializer

        workspace, skill, err = self._get_skill(request, skill_id)
        if err is not None:
            return err
        return Response(SkillSerializer(skill).data)

    def patch(self, request, skill_id):
        from agent_app.api.serializers import SkillPatchSerializer, SkillSerializer
        from agent_app.services.skill_manager import VersionConflict, patch_skill

        workspace, skill, err = self._get_skill(request, skill_id)
        if err is not None:
            return err

        serializer = SkillPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            skill = patch_skill(
                skill_id=str(skill.pk),
                patch_md=data['patch_md'],
                expected_version=data['expected_version'],
                patch_summary=data.get('patch_summary', ''),
            )
        except VersionConflict as exc:
            return Response(
                {
                    'error': 'version_conflict',
                    'detail': str(exc),
                    'current_version': exc.current_version,
                    'expected_version': exc.expected_version,
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(SkillSerializer(skill).data)

    def delete(self, request, skill_id):
        from agent_app.services.skill_manager import soft_delete_skill

        workspace, skill, err = self._get_skill(request, skill_id)
        if err is not None:
            return err
        soft_delete_skill(skill_id=str(skill.pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class SkillVersionsListView(APIView):
    """GET version history (newest first)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, skill_id):
        from agent_app.api.serializers import SkillVersionSerializer

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        # P2 #4 — soft-deleted skills are 404 by default. The version
        # history remains accessible with ``?include_deleted=true`` so
        # admins can audit deleted skills.
        skill_qs = Skill.objects.filter(id=skill_id, workspace=workspace)
        if request.query_params.get('include_deleted', '').lower() not in (
            '1', 'true', 'yes',
        ):
            skill_qs = skill_qs.filter(deleted_at__isnull=True)
        skill = get_object_or_404(skill_qs)
        rows = SkillVersion.objects.filter(skill=skill).order_by('-version')
        paginator = AgentPagination()
        page = paginator.paginate_queryset(rows, request)
        return paginator.get_paginated_response(
            SkillVersionSerializer(page, many=True).data,
        )


# ── Workspace Memory ──

class WorkspaceMemoryView(APIView):
    """GET (auto-create) + PATCH (char-limit enforced)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_or_create_memory(self, workspace):
        mem, _ = WorkspaceMemory.objects.get_or_create(workspace=workspace)
        return mem

    def get(self, request):
        from agent_app.api.serializers import WorkspaceMemorySerializer

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        mem = self._get_or_create_memory(workspace)
        return Response(WorkspaceMemorySerializer(mem).data)

    def patch(self, request):
        from agent_app.api.serializers import (
            WorkspaceMemoryPatchSerializer,
            WorkspaceMemorySerializer,
        )

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        serializer = WorkspaceMemoryPatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = serializer.validated_data.get('content_md', '')

        cfg = _ensure_workspace_config(workspace)
        if len(content or '') > cfg.memory_char_limit:
            return Response(
                {
                    'error': 'memory_char_limit_exceeded',
                    'limit': cfg.memory_char_limit,
                    'received': len(content or ''),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mem = self._get_or_create_memory(workspace)
        mem.content_md = content or ''
        try:
            mem.full_clean(exclude=['workspace'])
        except Exception as exc:
            return Response(
                {'error': 'validation', 'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mem.save(update_fields=['content_md', 'updated_at'])
        return Response(WorkspaceMemorySerializer(mem).data)


# ── User Profile ──

class UserProfileView(APIView):
    """GET caller's profile (auto-create) + PATCH (char-limit enforced).

    ``?include_reasoning=true`` exposes ``dialect_reasoning`` (read-only
    scratchpad) for the UI's collapsible reasoning section.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _include_reasoning(self, request) -> bool:
        return request.query_params.get('include_reasoning', '').lower() in (
            '1', 'true', 'yes',
        )

    def _get_or_create_profile(self, workspace, user):
        profile, _ = UserProfile.objects.get_or_create(
            workspace=workspace, user=user,
        )
        return profile

    def get(self, request):
        from agent_app.api.serializers import UserProfileSerializer

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        profile = self._get_or_create_profile(workspace, request.user)
        return Response(
            UserProfileSerializer(
                profile,
                context={'include_reasoning': self._include_reasoning(request)},
            ).data,
        )

    def patch(self, request):
        from agent_app.api.serializers import (
            UserProfilePatchSerializer,
            UserProfileSerializer,
        )

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserProfilePatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cfg = _ensure_workspace_config(workspace)
        if 'content_md' in data and data['content_md'] is not None:
            content = data['content_md'] or ''
            if len(content) > cfg.profile_char_limit:
                return Response(
                    {
                        'error': 'profile_char_limit_exceeded',
                        'limit': cfg.profile_char_limit,
                        'received': len(content),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        profile = self._get_or_create_profile(workspace, request.user)
        if 'content_md' in data and data['content_md'] is not None:
            profile.content_md = data['content_md'] or ''
        if 'dialect_cadence_sessions' in data:
            profile.dialect_cadence_sessions = data['dialect_cadence_sessions']
        try:
            profile.full_clean(exclude=['workspace', 'user'])
        except Exception as exc:
            return Response(
                {'error': 'validation', 'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.save(
            update_fields=[
                'content_md', 'dialect_cadence_sessions', 'updated_at',
            ],
        )
        return Response(
            UserProfileSerializer(
                profile,
                context={'include_reasoning': self._include_reasoning(request)},
            ).data,
        )


# ── Agent Workspace Config (admin-only) ──

class AgentWorkspaceConfigView(APIView):
    """GET (auto-create) + PATCH — admin only (AC-75)."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from agent_app.api.serializers import AgentWorkspaceConfigSerializer

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        if not _is_workspace_admin(request.user, workspace):
            return Response(
                {'error': 'Workspace admin only.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        cfg = _ensure_workspace_config(workspace)
        return Response(AgentWorkspaceConfigSerializer(cfg).data)

    def patch(self, request):
        from agent_app.api.serializers import AgentWorkspaceConfigSerializer

        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)
        if not _is_workspace_admin(request.user, workspace):
            return Response(
                {'error': 'Workspace admin only.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        cfg = _ensure_workspace_config(workspace)
        serializer = AgentWorkspaceConfigSerializer(
            cfg, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AgentWorkspaceConfigSerializer(cfg).data)


# ── Manual Reflection Trigger ──

class ReflectionTriggerView(APIView):
    """POST /api/agent/sessions/{id}/reflect/ — manual reflection trigger.

    Allowed when:
      - request.user owns the session, OR
      - the session is shared (``is_shared=True``) and request.user is an
        active workspace member.
    Session must be in COMPLETED status.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(
            AgentSession, id=session_id, workspace=workspace,
        )
        is_owner = (session.created_by_id == request.user.id)
        is_member = Membership.objects.filter(
            user=request.user, workspace=workspace, status='active',
        ).exists()
        if not (is_owner or (session.is_shared and is_member)):
            return Response(
                {'error': 'Not allowed.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if session.status != SessionStatus.COMPLETED:
            return Response(
                {'error': 'Session must be completed to reflect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # P2 #5 — dedup: if the workspace memory was last consolidated
        # against this same session, refuse to re-trigger. Prevents
        # accidental duplicate Skill creation / memory eviction churn
        # when the user double-clicks the Reflect button.
        existing_memory = WorkspaceMemory.objects.filter(
            workspace=workspace,
        ).only('last_consolidated_session_id').first()
        if (
            existing_memory is not None
            and existing_memory.last_consolidated_session_id == session.id
        ):
            return Response(
                {
                    'error': 'already_reflected',
                    'detail': (
                        'This session has already been consolidated into '
                        'workspace memory.'
                    ),
                    'session_id': str(session.pk),
                },
                status=status.HTTP_409_CONFLICT,
            )

        from agent_app.services.reflection_service import run_reflection

        # Enqueue (non-blocking) on the agent queue.
        try:
            queue = django_rq.get_queue('agent')
            queue.enqueue(run_reflection, str(session.pk))
        except Exception:
            # Fallback: run synchronously on the request thread.
            run_reflection(str(session.pk))

        return Response(
            {'detail': 'Reflection enqueued.', 'session_id': str(session.pk)},
            status=status.HTTP_202_ACCEPTED,
        )

import logging

import django_rq
from django.db.models import Count
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
    AutonomyPreset,
    KnowledgeDoc,
    MessageRole,
    SessionStatus,
    ToolPermission,
    WorkflowTemplate,
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
from agent_app.tasks import resume_agent_workflow, run_agent_workflow, run_batch_sequential
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

        # Collision detection (AC-34)
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
            if tmpl_obj:
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

        # Enqueue workflow
        queue = django_rq.get_queue('agent')
        queue.enqueue(run_agent_workflow, str(session.id))

        resp = AgentSessionDetailSerializer(session).data
        if collisions:
            resp['collisions'] = collisions
        return Response(resp, status=status.HTTP_201_CREATED)


class BatchSessionCreateView(APIView):
    """POST: batch start sessions for multiple niches (AC-31)."""
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
        niches = Niche.objects.filter(
            id__in=data['niche_ids'], workspace=workspace,
        )
        if niches.count() != len(data['niche_ids']):
            return Response(
                {'error': 'Some niche IDs not found in workspace'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template_key = data.get('workflow_template', '')
        total_steps = 0
        if template_key:
            tmpl_obj = WorkflowTemplate.objects.filter(
                workspace=workspace, key=template_key,
            ).first()
            if tmpl_obj:
                total_steps = len(tmpl_obj.steps)

        sessions = []
        for niche in niches:
            session = AgentSession.objects.create(
                workspace=workspace,
                created_by=request.user,
                title=f"{template_key or 'Batch'}: {niche.name}"[:200],
                niche_context=niche,
                workflow_template=template_key,
                autonomy_preset='assisted',
                total_steps=total_steps,
            )
            sessions.append(session)

        session_ids = [str(s.id) for s in sessions]
        queue = django_rq.get_queue('agent')

        if data.get('parallel'):
            # AC-32: parallel — separate jobs
            for sid in session_ids:
                queue.enqueue(run_agent_workflow, sid)
        else:
            # AC-32: sequential — single job processes all
            queue.enqueue(run_batch_sequential, session_ids)

        result = AgentSessionListSerializer(sessions, many=True).data
        return Response(result, status=status.HTTP_201_CREATED)


class AgentSessionDetailView(APIView):
    """GET: session detail + messages + progress (AC-48)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(
            AgentSession.objects.select_related('created_by', 'niche_context'),
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
    """POST: send command to agent (AC-48)."""
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

        msg = AgentMessage.objects.create(
            session=session,
            role=MessageRole.USER,
            content=serializer.validated_data['content'],
        )

        # If session is idle or paused, enqueue agent to process message
        if session.status in (SessionStatus.IDLE, SessionStatus.PAUSED):
            session.status = SessionStatus.RUNNING
            session.save(update_fields=['status', 'updated_at'])
            queue = django_rq.get_queue('agent')
            queue.enqueue(run_agent_workflow, str(session.id))

        return Response(AgentMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


class AgentSessionControlView(APIView):
    """POST: pause/resume/stop session (AC-40/41/42)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id, action):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(
            AgentSession, id=session_id, workspace=workspace, created_by=request.user,
        )

        if action == 'pause':
            if session.status != SessionStatus.RUNNING:
                return Response({'error': 'Session not running'}, status=status.HTTP_400_BAD_REQUEST)
            session.status = SessionStatus.PAUSED
            session.save(update_fields=['status', 'updated_at'])

        elif action == 'resume':
            if session.status != SessionStatus.PAUSED:
                return Response({'error': 'Session not paused'}, status=status.HTTP_400_BAD_REQUEST)
            session.status = SessionStatus.RUNNING
            session.save(update_fields=['status', 'updated_at'])
            queue = django_rq.get_queue('agent')
            queue.enqueue(resume_agent_workflow, str(session.id))

        elif action == 'stop':
            if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
                return Response({'error': 'Session not active'}, status=status.HTTP_400_BAD_REQUEST)
            session.status = SessionStatus.CANCELLED
            session.save(update_fields=['status', 'updated_at'])
            AgentMessage.objects.create(
                session=session,
                role=MessageRole.SYSTEM,
                content='Workflow stopped by user.',
            )

        else:
            return Response({'error': f'Unknown action: {action}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionShareView(APIView):
    """POST: share/unshare session (AC-60)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id, action):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(
            AgentSession, id=session_id, workspace=workspace, created_by=request.user,
        )

        session.is_shared = (action == 'share')
        session.save(update_fields=['is_shared', 'updated_at'])
        return Response(AgentSessionDetailSerializer(session).data)


class AgentSessionApproveRejectView(APIView):
    """POST: approve or reject pending action (AC-22/23)."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id, action_log_id, decision):
        workspace = _get_workspace(request.user)
        if not workspace:
            return Response({'error': 'No workspace'}, status=status.HTTP_403_FORBIDDEN)

        session = get_object_or_404(
            AgentSession, id=session_id, workspace=workspace, created_by=request.user,
        )
        action_log = get_object_or_404(
            AgentActionLog, id=action_log_id, session=session,
            status=ActionStatus.AWAITING_APPROVAL,
        )

        from agent_app.services.permission_checker import resolve_approval

        approved = (decision == 'approve')
        resolve_approval(action_log, approved)

        # If session was paused waiting for approval, resume
        if session.status == SessionStatus.PAUSED and approved:
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

        # Seed defaults if none exist
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

        docs = KnowledgeDoc.objects.filter(workspace=workspace)
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

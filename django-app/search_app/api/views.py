import json
import logging
import secrets
import time

import django_rq
from django.conf import settings
from django.db.models import Count
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from search_app.api.serializers import (
    ChatSessionCreateSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    ChatSessionUpdateSerializer,
    PublicChatSessionSerializer,
    SaveToNicheSerializer,
    SendMessageSerializer,
    TriggerCrawlSerializer,
    WebSearchResultSerializer,
)
from search_app.models import (
    ChatMessage,
    ChatSession,
    WebSearchResult,
)
from search_app.services.context_builder import build_system_instructions
from search_app.services.crawl_service import CrawlService
from search_app.services.mode_classifier import (
    ModeClassifierError,
    classify_mode,
)
from search_app.services.vane_service import VaneService, VaneServiceError
from search_app.tasks import execute_crawl, log_search_usage
from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership


class EventStreamRenderer(BaseRenderer):
    """Allow DRF content negotiation to accept `Accept: text/event-stream`.

    SSE views return `StreamingHttpResponse` directly; this renderer is just
    needed so DRF's `perform_content_negotiation` doesn't raise 406.
    """

    media_type = 'text/event-stream'
    format = 'sse'
    charset = 'utf-8'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Not actually used — views return StreamingHttpResponse directly.
        return data

logger = logging.getLogger(__name__)


class ChatSessionPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _resolve_workspace(request):
    """Resolve workspace from X-Workspace-Id header. Returns (workspace, error_response)."""
    workspace_id = request.headers.get('X-Workspace-Id')
    if not workspace_id:
        return None, Response(
            {'error': 'X-Workspace-Id header is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    membership = Membership.objects.filter(
        user=request.user,
        status=Membership.Status.ACTIVE,
        workspace_id=workspace_id,
    ).select_related('workspace').first()
    if not membership:
        return None, Response(
            {'error': 'No active workspace membership.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return membership.workspace, None


class ChatSessionListCreateView(APIView):
    """POST /api/chat/sessions/ -- create session.
    GET /api/chat/sessions/ -- list sessions.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        shared = request.query_params.get('shared')
        niche_id = request.query_params.get('niche_id')

        qs = ChatSession.objects.filter(workspace=workspace)

        if shared == 'true':
            # Shared sessions from all workspace members
            qs = qs.filter(is_shared=True)
        else:
            # Own sessions + shared sessions
            qs = qs.filter(created_by=request.user) | qs.filter(is_shared=True)
            qs = qs.distinct()

        if niche_id:
            qs = qs.filter(niche_context_id=niche_id)

        qs = qs.select_related('created_by', 'niche_context').annotate(
            _message_count=Count('messages')
        ).order_by('-updated_at')

        paginator = ChatSessionPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ChatSessionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        serializer = ChatSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Validate niche context belongs to workspace
        niche = None
        niche_id = data.get('niche_context')
        if niche_id:
            from niche_app.models import Niche
            try:
                niche = Niche.objects.get(pk=niche_id, workspace=workspace)
            except Niche.DoesNotExist:
                return Response(
                    {'error': 'Niche not found in this workspace.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        session = ChatSession.objects.create(
            workspace=workspace,
            created_by=request.user,
            title=data.get('title', ''),
            niche_context=niche,
        )

        out = ChatSessionDetailSerializer(session).data
        return Response(out, status=status.HTTP_201_CREATED)

    def delete(self, request):
        """Bulk-purge all chat sessions owned by the requesting user in the
        active workspace.

        PROJ-29 Phase 1F: requires explicit body ``{"confirm_purge": "all"}``
        (exact-string match) to guard against accidental wipes. Only the
        requesting user's own sessions in the resolved workspace are removed;
        other users' sessions in the same workspace are untouched. Returns
        ``{"deleted_count": N}``.
        """
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        if request.data.get('confirm_purge') != 'all':
            return Response(
                {'error': 'Missing or invalid confirm_purge. Send {"confirm_purge": "all"} to bulk-delete.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # `.delete()` returns ``(int total_rows, dict per_model_counts)`` where
        # ``total_rows`` includes cascade rows (ChatMessage etc.). Report just
        # the session count to keep the contract stable as cascades evolve.
        _total, per_model = ChatSession.objects.filter(
            workspace=workspace,
            created_by=request.user,
        ).delete()
        session_count = per_model.get('search_app.ChatSession', 0)
        return Response(
            {'deleted_count': session_count},
            status=status.HTTP_200_OK,
        )


class ChatSessionDetailView(APIView):
    """GET /api/chat/sessions/{id}/ -- session detail with messages.
    PATCH /api/chat/sessions/{id}/ -- update title/tags.
    DELETE /api/chat/sessions/{id}/ -- delete session.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_session(self, request, session_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return None, None, err
        try:
            session = ChatSession.objects.select_related(
                'created_by', 'niche_context'
            ).prefetch_related('messages').get(
                pk=session_id, workspace=workspace,
            )
        except ChatSession.DoesNotExist:
            return None, None, Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return workspace, session, None

    def get(self, request, session_id):
        workspace, session, err = self._get_session(request, session_id)
        if err:
            return err

        # AC-41: shared sessions readable by all workspace members
        if session.created_by != request.user and not session.is_shared:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ChatSessionDetailSerializer(session)
        return Response(serializer.data)

    def patch(self, request, session_id):
        workspace, session, err = self._get_session(request, session_id)
        if err:
            return err

        # Only owner can update
        if session.created_by != request.user:
            return Response(
                {'error': 'Only the session owner can update it.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ChatSessionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if 'title' in data:
            session.title = data['title']
            session.save(update_fields=['title', 'updated_at'])

        return Response(ChatSessionDetailSerializer(session).data)

    def delete(self, request, session_id):
        """Delete a chat session.

        PROJ-29 Phase 1F: only the session ``created_by`` user OR a
        workspace admin can delete. Cross-user / non-admin attempts return
        **404 (NOT 403)** to avoid leaking session existence (AC-Isolation-2
        info-leak prevention). ``ChatMessage.session`` is FK with
        ``on_delete=CASCADE`` -> cascade-delete handled at the ORM level.
        """
        workspace, session, err = self._get_session(request, session_id)
        if err:
            return err

        if session.created_by != request.user:
            is_workspace_admin = Membership.objects.filter(
                workspace=workspace,
                user=request.user,
                role=Membership.Role.ADMIN,
                status=Membership.Status.ACTIVE,
            ).exists()
            if not is_workspace_admin:
                return Response(
                    {'error': 'Session not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatSessionMessagesView(APIView):
    """POST /api/chat/sessions/{id}/messages/ -- send message, triggers Vane search.
    GET /api/chat/sessions/{id}/messages/ -- paginated messages (older than 50).

    POST `?stream=true` returns SSE — needs EventStreamRenderer to pass DRF
    content negotiation when Accept: text/event-stream.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [JSONRenderer, EventStreamRenderer]

    def get(self, request, session_id):
        """Load older messages (EC-9: pagination beyond latest 50)."""
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            session = ChatSession.objects.get(pk=session_id, workspace=workspace)
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # AC-41: check access
        if session.created_by != request.user and not session.is_shared:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        before = request.query_params.get('before')  # message ID cursor
        qs = session.messages.order_by('-created_at')

        if before:
            try:
                cursor_msg = ChatMessage.objects.get(pk=before, session=session)
                qs = qs.filter(created_at__lt=cursor_msg.created_at)
            except ChatMessage.DoesNotExist:
                pass

        messages = list(qs[:50])
        messages.reverse()

        from search_app.api.serializers import ChatMessageSerializer
        return Response({
            'messages': ChatMessageSerializer(messages, many=True).data,
            'has_more': qs.count() > 50,
        })

    def post(self, request, session_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            session = ChatSession.objects.select_related(
                'niche_context'
            ).get(pk=session_id, workspace=workspace)
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # AC-41: only owner can send messages
        if session.created_by != request.user:
            return Response(
                {'error': 'Cannot send messages to a session you do not own.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Pattern B Mode Classifier (AC-41 + EC-16):
        # mode_override='auto' → run LLM classifier to decide Vane vs. Agent.
        # mode_override='web_search'|'agent' → respect user's choice.
        mode_override = data.get('mode_override', 'auto')
        resolved_mode = mode_override
        classifier_result = None
        if mode_override == 'auto':
            try:
                classifier_result = classify_mode(
                    user_message=data['content'],
                    niche_context_name=(
                        session.niche_context.name
                        if session.niche_context else None
                    ),
                )
                resolved_mode = classifier_result['mode']
            except ModeClassifierError as e:
                logger.warning(
                    "Mode classifier failed, falling back to web_search: %s", e,
                )
                resolved_mode = 'web_search'

        # Create user message
        user_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content=data['content'],
            message_type=ChatMessage.MessageType.SEARCH_QUERY,
            search_mode=data.get('search_mode', 'balanced'),
            search_sources=data.get('search_sources', ['web']),
        )

        # Agent route (EC-16): create AgentSession + workflow_card ChatMessage,
        # return early. Frontend polls AgentSession status.
        if resolved_mode == 'agent':
            return self._handle_agent_route(
                request, workspace, session, user_msg, data,
                classifier_result,
            )

        # Auto-set title from first query
        if not session.title:
            session.title = data['content'][:200]
            session.save(update_fields=['title', 'updated_at'])

        # Build conversation history for Vane (AC-9)
        history = []
        prev_messages = session.messages.exclude(
            pk=user_msg.pk
        ).order_by('created_at')[:20]
        for msg in prev_messages:
            history.append({
                'role': msg.role,
                'content': msg.content,
            })

        # Build system instructions from niche context (AC-34)
        system_instructions = data.get('system_instructions', '')
        if not system_instructions and session.niche_context:
            system_instructions = build_system_instructions(session.niche_context)

        # Check for streaming
        stream = request.query_params.get('stream') == 'true'

        vane = VaneService()
        model = data.get('model') or None

        if stream:
            return self._handle_stream(
                vane, session, user_msg, data, history,
                system_instructions, model, workspace, request.user,
            )

        # Synchronous search
        try:
            result = vane.search(
                query=data['content'],
                mode=data.get('search_mode', 'balanced'),
                sources=data.get('search_sources', ['web']),
                history=history,
                system_instructions=system_instructions,
                model=model,
            )
        except VaneServiceError as e:
            logger.error("Vane search failed: %s", e)
            # Create error message for session history
            ChatMessage.objects.create(
                session=session,
                role=ChatMessage.Role.SYSTEM,
                content=f"Search failed: {e}",
                message_type=ChatMessage.MessageType.SEARCH_RESULT,
            )
            return Response(
                {'error': str(e), 'user_message': str(user_msg.pk)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Create assistant message with results
        assistant_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content=result['answer'],
            message_type=ChatMessage.MessageType.SEARCH_RESULT,
            sources=result['sources'],
            search_mode=data.get('search_mode', 'balanced'),
            search_sources=data.get('search_sources', ['web']),
            model_used=result.get('model_used', ''),
        )

        # Touch session updated_at
        session.save(update_fields=['updated_at'])

        # Log usage (fire-and-forget)
        try:
            queue = django_rq.get_queue('default')
            queue.enqueue(
                log_search_usage,
                workspace_id=str(workspace.id),
                user_id=request.user.id,
                action='search',
                query=data['content'],
                model_used=result.get('model_used', ''),
            )
        except Exception:
            logger.warning("Failed to enqueue usage log", exc_info=True)

        from search_app.api.serializers import ChatMessageSerializer
        return Response({
            'user_message': ChatMessageSerializer(user_msg).data,
            'assistant_message': ChatMessageSerializer(assistant_msg).data,
        }, status=status.HTTP_201_CREATED)

    def _handle_stream(
        self, vane, session, user_msg, data, history,
        system_instructions, model, workspace, user,
    ):
        """Return SSE StreamingHttpResponse for streaming Vane search."""

        def event_stream():
            try:
                final_answer = ''
                final_sources = []

                for event in vane.search_stream(
                    query=data['content'],
                    mode=data.get('search_mode', 'balanced'),
                    sources=data.get('search_sources', ['web']),
                    history=history,
                    system_instructions=system_instructions,
                    model=model,
                ):
                    yield event

                    # Parse done event to save assistant message
                    if '"type": "done"' in event or '"type":"done"' in event:
                        try:
                            event_data = json.loads(
                                event.replace('data: ', '').strip()
                            )
                            final_answer = event_data.get('answer', '')
                            final_sources = event_data.get('sources', [])
                        except (json.JSONDecodeError, ValueError):
                            pass

                # Save assistant message after stream completes
                if final_answer:
                    ChatMessage.objects.create(
                        session=session,
                        role=ChatMessage.Role.ASSISTANT,
                        content=final_answer,
                        message_type=ChatMessage.MessageType.SEARCH_RESULT,
                        sources=final_sources,
                        search_mode=data.get('search_mode', 'balanced'),
                        search_sources=data.get('search_sources', ['web']),
                        model_used=model or vane.default_model,
                    )
                    session.save(update_fields=['updated_at'])

                # Log usage
                try:
                    queue = django_rq.get_queue('default')
                    queue.enqueue(
                        log_search_usage,
                        workspace_id=str(workspace.id),
                        user_id=user.id,
                        action='search',
                        query=data['content'],
                        model_used=model or vane.default_model,
                    )
                except Exception:
                    pass

            except VaneServiceError as e:
                yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def _handle_agent_route(
        self, request, workspace, session, user_msg, data,
        classifier_result,
    ):
        """Pattern B (EC-16): user message routes to PROJ-18 Agent.

        Creates an AgentSession via the agent_app ORM, then a
        `workflow_card` ChatMessage referencing it. Frontend renders an
        inline WorkflowCard with mini-stepper + approval buttons.
        """
        try:
            from agent_app.models import AgentSession, SessionStatus
        except ImportError:
            logger.error("agent_app not installed — cannot route to agent.")
            # EC-17: graceful fallback — system message + return
            sys_msg = ChatMessage.objects.create(
                session=session,
                role=ChatMessage.Role.SYSTEM,
                content='Agent unavailable. Please retry with Web-Search mode.',
                message_type=ChatMessage.MessageType.SEARCH_RESULT,
            )
            from search_app.api.serializers import ChatMessageSerializer
            return Response(
                {
                    'user_message': ChatMessageSerializer(user_msg).data,
                    'assistant_message': ChatMessageSerializer(sys_msg).data,
                    'mode': 'web_search',
                    'fallback_reason': 'agent_app unavailable',
                },
                status=status.HTTP_201_CREATED,
            )

        try:
            agent_session = AgentSession.objects.create(
                workspace=workspace,
                created_by=request.user,
                title=data['content'][:200],
                status=SessionStatus.IDLE,
                niche_context=session.niche_context,
            )
        except Exception:
            logger.error("Failed to create AgentSession.", exc_info=True)
            return Response(
                {'error': 'Failed to start agent workflow.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Create workflow_card ChatMessage referencing the new AgentSession
        workflow_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.ASSISTANT,
            content=(
                classifier_result.get('reason', '')
                if classifier_result else 'Agent workflow started.'
            ),
            message_type=ChatMessage.MessageType.WORKFLOW_CARD,
            agent_session=agent_session,
            model_used=(
                'gpt-4.1-mini-classifier'
                if classifier_result else 'manual'
            ),
        )
        session.save(update_fields=['updated_at'])

        from search_app.api.serializers import ChatMessageSerializer
        return Response(
            {
                'user_message': ChatMessageSerializer(user_msg).data,
                'assistant_message': ChatMessageSerializer(workflow_msg).data,
                'mode': 'agent',
                'agent_session_id': str(agent_session.id),
                'classifier': classifier_result,
            },
            status=status.HTTP_201_CREATED,
        )


def _serialize_sse(event: dict) -> str:
    """Serialize a ``{'event': name, 'data': dict}`` payload to SSE wire format.

    Format (Phase 1E): ``event: <name>\\ndata: <json>\\n\\n``.
    """
    name = event.get('event', 'message')
    data = event.get('data', {})
    return f"event: {name}\ndata: {json.dumps(data)}\n\n"


def _wrap_with_heartbeat(event_generator, interval_s: float = 3.0):
    """Wrap an event generator with a heartbeat injector.

    Yields ``{'event': 'heartbeat', 'data': {'elapsed_ms': N}}`` every
    ``interval_s`` seconds whenever the underlying generator hasn't produced
    a real event yet. Uses a worker thread + queue so the heartbeat fires
    even when the underlying generator is blocked inside a slow tool call.

    Heartbeats stop being emitted once a ``chunk`` event has fired (token
    streaming has begun — the frontend updates the bubble at every chunk so
    no further keep-alive is needed).
    """
    import queue as _queue
    import threading
    import time as _time

    sentinel = object()
    q: _queue.Queue = _queue.Queue()
    started_at = _time.monotonic()

    def _producer():
        try:
            for evt in event_generator:
                q.put(evt)
        except Exception as exc:  # pragma: no cover - defensive
            q.put({
                'event': 'error',
                'data': {'code': type(exc).__name__, 'retry_after_s': 30},
            })
        finally:
            q.put(sentinel)

    thread = threading.Thread(target=_producer, daemon=True)
    thread.start()

    chunk_fired = False
    while True:
        try:
            item = q.get(timeout=interval_s)
        except _queue.Empty:
            if chunk_fired:
                # Streaming is live; UI gets feedback from chunks themselves.
                continue
            elapsed_ms = int((_time.monotonic() - started_at) * 1000)
            yield {
                'event': 'heartbeat',
                'data': {'elapsed_ms': elapsed_ms},
            }
            continue
        if item is sentinel:
            return
        if item.get('event') == 'chunk':
            chunk_fired = True
        yield item


class ChatSessionMessageStreamView(APIView):
    """GET /api/chat/sessions/{id}/messages/stream/?content=...&search_mode=...

    Separate SSE endpoint (AC-18) so the frontend can use the native
    `EventSource` API (which only supports GET).

    Query params:
        content: required user message text
        search_mode: speed|balanced|quality (default balanced)
        search_sources: comma-separated (web,academic,discussions)
        model: optional OpenRouter model override

    Yields SSE events: init, sources, response (chunks), done.

    PROJ-29 Phase 1E: when the session has ``niche_context`` set, the request
    routes through the niche-chat agent (``run_chat``) instead of the legacy
    Vane path. Throttled at 30/min per user via the ``chat_agent`` scope.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    renderer_classes = [EventStreamRenderer, JSONRenderer]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'chat_agent'

    def get(self, request, session_id):
        # EventSource cannot send custom headers — resolve workspace from the
        # session itself + verify user has active membership there.
        try:
            session = ChatSession.objects.select_related(
                'niche_context', 'workspace'
            ).get(pk=session_id)
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        membership_exists = Membership.objects.filter(
            user=request.user,
            status=Membership.Status.ACTIVE,
            workspace=session.workspace,
        ).exists()
        if not membership_exists:
            return Response(
                {'error': 'Session not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        workspace = session.workspace

        if session.created_by != request.user:
            return Response(
                {'error': 'Cannot send messages to a session you do not own.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        content = request.query_params.get('content', '').strip()
        if not content:
            return Response(
                {'error': 'content query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Cleanup 2026-04-28: `search_mode` is the Vane optimization knob
        # (speed/balanced/quality). The frontend used to overload this with
        # routing intent ('web_search'/'agent') — those values fell through
        # to 'balanced'. We now accept an explicit `optimization_mode` (and
        # keep `search_mode` as a fallback for backward compatibility).
        search_mode = (
            request.query_params.get('optimization_mode')
            or request.query_params.get('search_mode')
            or 'balanced'
        )
        if search_mode not in ('speed', 'balanced', 'quality'):
            search_mode = 'balanced'

        sources_raw = request.query_params.get('search_sources', 'web')
        search_sources = [
            s.strip() for s in sources_raw.split(',')
            if s.strip() in ('web', 'academic', 'discussions')
        ] or ['web']

        model = request.query_params.get('model') or None

        # PROJ-20 Phase 7.3 — image attachments routed through the Vision
        # path (OpenRouter direct, no Vane). Comma-separated UUIDs.
        attachment_ids_raw = request.query_params.get('attachment_ids', '')
        attachment_ids = [
            s.strip() for s in attachment_ids_raw.split(',') if s.strip()
        ]

        # Cleanup 2026-04-28: read per-message niche_id query param. If
        # provided, override session.niche_context for THIS request only.
        # This lets follow-up messages re-target a niche without creating a
        # new session.
        per_message_niche_id = request.query_params.get('niche_id') or None

        # PROJ-20 Phase 7.3 — Vision branch. If the request carries
        # attachment_ids the message goes through OpenRouter directly with
        # image content blocks; Vane is bypassed (no native vision support).
        if attachment_ids:
            from chat_attachments_app.vision import (
                AttachmentResolutionError,
                build_vision_content_blocks,
                resolve_attachments,
                resolve_vision_model,
                stream_vision_chunks,
            )
            try:
                attachments = resolve_attachments(attachment_ids, workspace)
            except AttachmentResolutionError as exc:
                return Response(
                    {'error': str(exc)},
                    status=status.HTTP_404_NOT_FOUND,
                )

            user_msg = ChatMessage.objects.create(
                session=session,
                role=ChatMessage.Role.USER,
                content=content,
                message_type=ChatMessage.MessageType.SEARCH_QUERY,
                search_mode=search_mode,
                search_sources=search_sources,
            )
            # Link freshly-uploaded attachments to the just-persisted user
            # message so chat-history rendering can surface thumbnails. On
            # Regenerate the same attachment ids are re-sent — those records
            # are already pointed at the original user message, so leave
            # them alone to keep the prior bubble's thumbnails intact.
            for att in attachments:
                if att.message_id is None:
                    att.message_id = user_msg.pk
                    att.save(update_fields=['message'])

            if not session.title:
                session.title = content[:200]
                session.save(update_fields=['title', 'updated_at'])

            history = []
            prev_messages = session.messages.exclude(
                pk=user_msg.pk
            ).order_by('created_at')[:20]
            for msg in prev_messages:
                history.append({'role': msg.role, 'content': msg.content})

            from niche_app.models import Niche as _Niche
            system_instructions = ''
            niche_for_context = None
            if per_message_niche_id:
                try:
                    niche_for_context = _Niche.objects.get(
                        pk=per_message_niche_id, workspace=workspace,
                    )
                except (_Niche.DoesNotExist, ValueError, TypeError):
                    niche_for_context = None
            if niche_for_context is None:
                niche_for_context = session.niche_context
            if niche_for_context:
                system_instructions = build_system_instructions(niche_for_context)

            effective_model, fallback_fired = resolve_vision_model(model)
            content_blocks = build_vision_content_blocks(content, attachments)

            def vision_event_stream():
                yield (
                    'event: init\n'
                    'data: ' + json.dumps({
                        'message_id': str(user_msg.pk),
                        'session_id': str(session.pk),
                        'mode': 'vision',
                        'model_used': effective_model,
                        'vision_fallback': fallback_fired,
                    }) + '\n\n'
                )
                final_answer = ''
                try:
                    for chunk_text in stream_vision_chunks(
                        user_content_blocks=content_blocks,
                        history=history,
                        model=effective_model,
                        system_instructions=system_instructions,
                    ):
                        final_answer += chunk_text
                        yield (
                            'event: chunk\n'
                            'data: ' + json.dumps({'text': chunk_text}) + '\n\n'
                        )
                except Exception as exc:  # noqa: BLE001 - user-facing error
                    logger.exception('Vision stream failed')
                    yield (
                        'event: error\n'
                        'data: ' + json.dumps({'error': str(exc)}) + '\n\n'
                    )
                    return

                if final_answer:
                    assistant_msg = ChatMessage.objects.create(
                        session=session,
                        role=ChatMessage.Role.ASSISTANT,
                        content=final_answer,
                        message_type=ChatMessage.MessageType.SEARCH_RESULT,
                        sources=[],
                        search_mode=search_mode,
                        search_sources=search_sources,
                        model_used=effective_model,
                    )
                    session.save(update_fields=['updated_at'])
                    yield (
                        'event: done\n'
                        'data: ' + json.dumps({
                            'message_id': str(assistant_msg.pk),
                            'total_tokens': 0,
                        }) + '\n\n'
                    )

            response = StreamingHttpResponse(
                vision_event_stream(),
                content_type='text/event-stream',
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

        # Persist the user message
        user_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content=content,
            message_type=ChatMessage.MessageType.SEARCH_QUERY,
            search_mode=search_mode,
            search_sources=search_sources,
        )

        # Auto-set title from first query
        if not session.title:
            session.title = content[:200]
            session.save(update_fields=['title', 'updated_at'])

        # Build conversation history
        history = []
        prev_messages = session.messages.exclude(
            pk=user_msg.pk
        ).order_by('created_at')[:20]
        for msg in prev_messages:
            history.append({'role': msg.role, 'content': msg.content})

        # Cleanup 2026-04-28: prefer per-message niche_id query param if it
        # resolves to a workspace-scoped niche; otherwise fall back to the
        # niche stored on the session at create-time.
        from niche_app.models import Niche
        system_instructions = ''
        niche_for_context = None
        if per_message_niche_id:
            try:
                niche_for_context = Niche.objects.get(
                    pk=per_message_niche_id, workspace=workspace,
                )
            except (Niche.DoesNotExist, ValueError, TypeError):
                niche_for_context = None
        if niche_for_context is None:
            niche_for_context = session.niche_context
        if niche_for_context:
            system_instructions = build_system_instructions(niche_for_context)

        # PROJ-29 Phase 1E — niche-bound agent path.
        # When the session has a pinned niche, route through the niche-chat
        # agent (run_chat). The legacy Vane path stays untouched for sessions
        # without niche_context (general web-search chat).
        if session.niche_context is not None:
            return self._handle_niche_agent_stream(
                request, workspace, session, user_msg, content,
                model_override=model,
            )

        vane = VaneService()
        user_id = request.user.id
        workspace_id = str(workspace.id)

        def event_stream():
            """Generator yielding SSE events. Persists assistant message at done.

            Emits proper SSE event-named frames (`event: <name>\\ndata: {...}\\n\\n`)
            so the frontend's `EventSource.addEventListener('init'|'chunk'|...)`
            named listeners fire. Also normalises field names + maps Vane's
            `response` chunks to the frontend's `chunk` event.
            """
            yield (
                f"event: init\ndata: {json.dumps({'message_id': str(user_msg.pk), 'session_id': str(session.pk), 'mode': 'web_search'})}\n\n"
            )

            final_answer = ''
            final_sources: list = []

            try:
                for event in vane.search_stream(
                    query=content,
                    mode=search_mode,
                    sources=search_sources,
                    history=history,
                    system_instructions=system_instructions,
                    model=model,
                ):
                    # Vane events arrive as `data: {"type": "<X>", ...}\n\n`.
                    # Re-emit with proper SSE event names + frontend-shaped payloads.
                    try:
                        event_data = json.loads(
                            event.replace('data: ', '', 1).strip()
                        )
                    except (json.JSONDecodeError, ValueError):
                        continue

                    vane_type = event_data.get('type', '')

                    if vane_type == 'response':
                        chunk_text = event_data.get('data', '')
                        final_answer += chunk_text
                        if chunk_text:
                            yield (
                                f"event: chunk\ndata: {json.dumps({'text': chunk_text})}\n\n"
                            )
                    elif vane_type == 'sources':
                        srcs = event_data.get('data', []) or []
                        if isinstance(srcs, list):
                            final_sources = srcs
                            yield (
                                f"event: sources\ndata: {json.dumps({'sources': srcs})}\n\n"
                            )
                    elif vane_type == 'done':
                        # Vane's done has the full answer + sources — replace
                        # accumulated values to ensure consistency.
                        final_answer = event_data.get('answer', final_answer)
                        final_sources = event_data.get('sources', final_sources)
                    # else: init / unknown — frontend's init already fired above
            except VaneServiceError as e:
                yield (
                    f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                )
                return

            # Persist assistant message after stream completes
            if final_answer:
                assistant_msg = ChatMessage.objects.create(
                    session=session,
                    role=ChatMessage.Role.ASSISTANT,
                    content=final_answer,
                    message_type=ChatMessage.MessageType.SEARCH_RESULT,
                    sources=final_sources,
                    search_mode=search_mode,
                    search_sources=search_sources,
                    model_used=model or vane.default_model,
                )
                session.save(update_fields=['updated_at'])
                # Frontend listens for `done` (not `persisted`) — emit final marker.
                try:
                    total_tokens = int(
                        VaneService.estimate_tokens(content + final_answer)
                    )
                except (TypeError, ValueError):
                    total_tokens = 0
                yield (
                    f"event: done\ndata: {json.dumps({'message_id': str(assistant_msg.pk), 'total_tokens': total_tokens})}\n\n"
                )

                # Log usage with rough token count
                try:
                    queue = django_rq.get_queue('default')
                    queue.enqueue(
                        log_search_usage,
                        workspace_id=workspace_id,
                        user_id=user_id,
                        action='search',
                        query=content,
                        model_used=model or vane.default_model,
                        tokens_used=VaneService.estimate_tokens(
                            content + final_answer,
                        ),
                    )
                except Exception:
                    pass

        response = StreamingHttpResponse(
            event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    def _handle_niche_agent_stream(
        self, request, workspace, session, user_msg, content,
        model_override=None,
    ):
        """PROJ-29 Phase 1E — stream the niche-chat agent.

        Wraps the request in a Langfuse trace (no-op when credentials absent),
        invokes ``run_chat`` for orchestration, and serializes the resulting
        event dicts into the SSE wire format. Persists the final assistant
        message on ``done``.
        """
        from agent_app.agents.niche_chat_agent import run_chat
        from core.observability.langfuse_handler import get_langfuse_handler

        # Trace handle is best-effort — initialisation registers the session
        # with the Langfuse client when keys are present, and short-circuits
        # to ``None`` when they aren't (graceful no-op).
        get_langfuse_handler(
            trace_name='chat_session_stream',
            trace_id=str(session.id),
            metadata={
                'workspace_id': str(workspace.id),
                'niche_context_id': (
                    str(session.niche_context.id)
                    if session.niche_context else None
                ),
                'user_id': str(request.user.id),
                'mode': 'agent',
            },
        )

        def agent_event_stream():
            slogan_payload = None
            chunks_used_buf: list[dict] = []
            thinking_stages_buf: list[dict] = []
            # PROJ-29 follow-up: capture `sources` events fired by run_chat
            # when the agent invokes `web_search`. Persisted on the
            # ChatMessage row so SourceList re-renders after page reload.
            sources_buf: list[dict] = []
            # Track in-flight stages by name so tool_result / tool_timeout can
            # close them out with a status + durationMs.
            stage_idx_by_name: dict[str, int] = {}
            try:
                inner = run_chat(session, content, model_override=model_override)
                for evt in _wrap_with_heartbeat(inner):
                    event_name = evt.get('event')
                    data = evt.get('data') or {}
                    if event_name == 'generate_slogans_payload':
                        slogan_payload = data or None
                        yield _serialize_sse(evt)
                        continue
                    if event_name == 'sources':
                        # Accumulate web_search source list for persistence.
                        new_sources = list(data.get('sources') or [])
                        sources_buf.extend(new_sources)
                        yield _serialize_sse(evt)
                        continue
                    if event_name == 'chunks_used':
                        # Capture for persistence — frontend ExpandedPanel +
                        # NicheCitationLink need this to render after reload.
                        new_chunks = list(data.get('chunks') or [])
                        chunks_used_buf.extend(new_chunks)
                        yield _serialize_sse(evt)
                        continue
                    if event_name in ('stage', 'tool_call'):
                        # Open a new stage row.
                        stage_name = (
                            data.get('stage')
                            or data.get('tool')
                            or data.get('tool_name')
                            or 'unknown'
                        )
                        row = {
                            'stage': stage_name,
                            'status': 'loading',
                            'ts': int(time.time() * 1000),
                        }
                        thinking_stages_buf.append(row)
                        stage_idx_by_name[stage_name] = len(thinking_stages_buf) - 1
                        yield _serialize_sse(evt)
                        continue
                    if event_name in ('tool_result', 'tool_timeout'):
                        stage_name = (
                            data.get('tool')
                            or data.get('tool_name')
                            or 'unknown'
                        )
                        idx = stage_idx_by_name.get(stage_name)
                        if idx is not None and idx < len(thinking_stages_buf):
                            row = thinking_stages_buf[idx]
                            row['status'] = (
                                'warning' if event_name == 'tool_timeout' else 'done'
                            )
                            duration = data.get('duration_ms')
                            if duration is not None:
                                row['durationMs'] = duration
                            if event_name == 'tool_timeout':
                                row['message'] = data.get('output_preview') or data.get('error') or ''
                        yield _serialize_sse(evt)
                        continue
                    if event_name == 'done':
                        # Persist the assistant turn HERE (before emitting `done`
                        # on the wire) so the wire can carry the persisted
                        # message id.
                        final_answer = data.get('final_answer', '') or ''
                        assistant_msg = None
                        if final_answer:
                            assistant_msg = ChatMessage.objects.create(
                                session=session,
                                role=ChatMessage.Role.ASSISTANT,
                                content=final_answer,
                                message_type=ChatMessage.MessageType.SEARCH_RESULT,
                                # PROJ-29 follow-up: persist web_search sources
                                # so SourceList + [N] citation markers render
                                # after page reload (same field the legacy
                                # Vane path uses).
                                sources=sources_buf or [],
                                search_mode='balanced',
                                search_sources=['niche_agent'],
                                model_used='niche_chat_agent',
                                generate_slogans_payload=slogan_payload,
                                chunks_used=(chunks_used_buf or None),
                                thinking_stages=(thinking_stages_buf or None),
                            )
                            session.save(update_fields=['updated_at'])
                        done_data = dict(data)
                        if assistant_msg is not None:
                            done_data['message_id'] = str(assistant_msg.pk)
                        yield _serialize_sse({'event': 'done', 'data': done_data})
                        continue
                    yield _serialize_sse(evt)
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception('niche_chat_agent stream failed')
                from core.observability.sentry import capture_chat_error
                capture_chat_error(
                    session_id=str(session.id),
                    user_id=str(request.user.id),
                    exception=exc,
                    workspace_id=str(workspace.id),
                    niche_id=(
                        str(session.niche_context.id)
                        if session.niche_context else None
                    ),
                    message_content=content,
                )
                yield _serialize_sse({
                    'event': 'error',
                    'data': {
                        'code': type(exc).__name__,
                        'retry_after_s': 30,
                    },
                })
                return

        response = StreamingHttpResponse(
            agent_event_stream(),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class ChatSessionShareCreateView(APIView):
    """POST /api/chat/sessions/{id}/share/ -- generate (or return) public share-link.

    PROJ-20 AC-30 / Phase 1.3:
    - Generates `secrets.token_urlsafe(32)` and persists to `ChatSession.share_token`
      on first call; sets `is_shared=True`.
    - Idempotent: subsequent calls return the SAME token (no regeneration) so the
      "Copy share link" UI never invalidates a previously distributed URL.
    - Returns `{share_token, public_url, is_shared, id}`. `public_url` is built
      from the request host (preferred) or falls back to `settings.FRONTEND_URL`.
    - Workspace-membership check: only the session owner can create a share-link.
      Cross-workspace returns 404 (info-leak prevention) — matches Phase 1.2.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            session = ChatSession.objects.get(
                pk=session_id, workspace=workspace, created_by=request.user,
            )
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Session not found or not owned by you.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Idempotency: only generate a token if one isn't already set.
        update_fields = []
        if not session.share_token:
            session.share_token = secrets.token_urlsafe(32)
            update_fields.append('share_token')
        if not session.is_shared:
            session.is_shared = True
            update_fields.append('is_shared')
        if update_fields:
            update_fields.append('updated_at')
            session.save(update_fields=update_fields)

        # Build the public URL. Prefer the request host (works behind Caddy +
        # in dev with build_absolute_uri) and fall back to FRONTEND_URL.
        relative_path = f'/shared/chat/{session.share_token}'
        try:
            public_url = request.build_absolute_uri(relative_path)
        except Exception:
            public_url = (
                f"{getattr(settings, 'FRONTEND_URL', '').rstrip('/')}{relative_path}"
            )

        return Response({
            'id': str(session.id),
            'is_shared': True,
            'share_token': session.share_token,
            'public_url': public_url,
        })


class ChatSessionPublicFetchView(APIView):
    """GET /api/chat/sessions/shared/<token>/ -- public read-only fetch of a chat.

    PROJ-20 AC-30 / Phase 1.3:
    - NO authentication required — this is the public viewer endpoint.
    - Returns the session + ordered messages + sources via
      `PublicChatSessionSerializer` (read-only, excludes owner email + internal fields).
    - 404 if the token is unknown OR `is_shared=False` (revoked).
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            session = ChatSession.objects.select_related(
                'niche_context'
            ).prefetch_related('messages').get(
                share_token=token, is_shared=True,
            )
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Shared chat not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PublicChatSessionSerializer(session)
        return Response(serializer.data)


class ChatSessionUnshareView(APIView):
    """POST /api/chat/sessions/{id}/unshare/ -- unshare session."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            session = ChatSession.objects.get(
                pk=session_id, workspace=workspace, created_by=request.user,
            )
        except ChatSession.DoesNotExist:
            return Response(
                {'error': 'Session not found or not owned by you.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        session.is_shared = False
        session.save(update_fields=['is_shared', 'updated_at'])
        return Response({'id': str(session.id), 'is_shared': False})


class ChatMessageDestroyView(APIView):
    """DELETE /api/chat/messages/{message_id}/ -- delete a single chat message.

    Used by the AC-30 Regenerate flow (PROJ-20): the previous AI message must be
    deleted before re-streaming. Cross-workspace access returns 404 to match the
    info-leak-prevention convention used elsewhere in this file.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id):
        try:
            message = ChatMessage.objects.select_related(
                'session', 'session__workspace',
            ).get(pk=message_id)
        except ChatMessage.DoesNotExist:
            return Response(
                {'error': 'Message not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Workspace-membership check via message.session.workspace.
        # Return 404 (not 403) to avoid leaking existence of foreign messages.
        membership_exists = Membership.objects.filter(
            user=request.user,
            status=Membership.Status.ACTIVE,
            workspace=message.session.workspace,
        ).exists()
        if not membership_exists:
            return Response(
                {'error': 'Message not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TriggerCrawlView(APIView):
    """POST /api/search/crawl/ -- trigger Crawl4ai deep crawl."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        serializer = TriggerCrawlSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Validate chat_message belongs to workspace
        chat_message = None
        if data.get('chat_message_id'):
            try:
                chat_message = ChatMessage.objects.select_related(
                    'session'
                ).get(
                    pk=data['chat_message_id'],
                    session__workspace=workspace,
                )
            except ChatMessage.DoesNotExist:
                return Response(
                    {'error': 'Chat message not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        result = WebSearchResult.objects.create(
            workspace=workspace,
            chat_message=chat_message,
            url=data['url'],
            content_type=WebSearchResult.ContentType.SNIPPET,
            crawl_status=WebSearchResult.CrawlStatus.PENDING,
        )

        # Enqueue crawl job on the dedicated `search` queue (AC-11)
        try:
            queue = django_rq.get_queue('search')
            queue.enqueue(execute_crawl, str(result.pk))
        except Exception:
            logger.error("Failed to enqueue crawl job", exc_info=True)
            result.crawl_status = WebSearchResult.CrawlStatus.FAILED
            result.error_message = 'Failed to enqueue crawl job.'
            result.save(update_fields=['crawl_status', 'error_message'])

        # Log usage
        try:
            queue = django_rq.get_queue('default')
            queue.enqueue(
                log_search_usage,
                workspace_id=str(workspace.id),
                user_id=request.user.id,
                action='deep_crawl',
                url=data['url'],
            )
        except Exception:
            pass

        return Response(
            WebSearchResultSerializer(result).data,
            status=status.HTTP_201_CREATED,
        )


class CrawlStatusView(APIView):
    """GET /api/search/crawl/{id}/status/ -- poll crawl job status."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, result_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            result = WebSearchResult.objects.get(
                pk=result_id, workspace=workspace,
            )
        except WebSearchResult.DoesNotExist:
            return Response(
                {'error': 'Search result not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(WebSearchResultSerializer(result).data)


class SaveToNicheView(APIView):
    """POST /api/search/results/{id}/save-to-niche/ -- save result to niche."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, result_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            result = WebSearchResult.objects.get(
                pk=result_id, workspace=workspace,
            )
        except WebSearchResult.DoesNotExist:
            return Response(
                {'error': 'Search result not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SaveToNicheSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from niche_app.models import Niche
        try:
            niche = Niche.objects.get(
                pk=data['niche_id'], workspace=workspace,
            )
        except Niche.DoesNotExist:
            return Response(
                {'error': 'Niche not found in this workspace.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        save_as = data['save_as']
        selected_text = (data.get('selected_text') or '').strip()
        # Fallback to result title when no manual snippet was selected
        text = selected_text or (result.title or '').strip()

        if save_as == 'notes':
            if not text:
                return Response(
                    {'error': 'No text to save (provide selected_text or result must have title).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            separator = '\n\n---\n\n' if niche.notes else ''
            source_info = f"**Source:** [{result.title or result.url}]({result.url})\n\n"
            niche.notes += f"{separator}{source_info}{text[:5000]}"
            niche.save(update_fields=['notes', 'updated_at'])
            return Response({
                'saved': True,
                'save_as': 'notes',
                'niche_id': str(niche.id),
                'niche_name': niche.name,
            })

        elif save_as == 'keywords':
            # Split selected_text by comma OR newline → one NicheKeyword per token
            import re
            tokens = [
                t.strip() for t in re.split(r'[,\n]+', text)
                if t.strip()
            ]
            if not tokens:
                return Response(
                    {'error': 'No keyword tokens found in selected_text.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                from keyword_app.models import NicheKeyword
            except ImportError:
                return Response(
                    {'error': 'Keyword app not available.'},
                    status=status.HTTP_501_NOT_IMPLEMENTED,
                )

            created, skipped = 0, 0
            created_ids = []
            for token in tokens:
                kw_text = token[:200]
                if NicheKeyword.objects.filter(
                    niche=niche, keyword__iexact=kw_text,
                ).exists():
                    skipped += 1
                    continue
                try:
                    kw = NicheKeyword.objects.create(
                        niche=niche,
                        keyword=kw_text,
                        source='web_search',
                        created_by=request.user,
                    )
                    created += 1
                    created_ids.append(str(kw.id))
                except Exception as e:
                    logger.warning("Failed to save keyword '%s': %s", kw_text, e)
                    skipped += 1

            return Response({
                'saved': True,
                'save_as': 'keywords',
                'niche_id': str(niche.id),
                'niche_name': niche.name,
                'created': created,
                'skipped': skipped,
                'created_ids': created_ids,
            })

        return Response(
            {'error': f'Unknown save_as value: {save_as}'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class SearchHealthView(APIView):
    """GET /api/search/health/ -- check Vane + Crawl4ai status.

    Frontend uses adaptive polling: 60s when healthy, 5s when offline.
    Cache-Control set short so the offline-recovery flow isn't blocked by HTTP cache.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vane = VaneService()
        crawl = CrawlService()

        vane_status = 'online' if vane.health_check() else 'offline'
        crawl_status = 'online' if crawl.health_check() else 'offline'

        response = Response({
            'vane': vane_status,
            'crawl4ai': crawl_status,
        })
        # Short cache (3s) — long enough to dedupe burst polls, short enough
        # to allow 5s offline-recovery polling to surface state changes quickly.
        response['Cache-Control'] = 'private, max-age=3'
        return response


class ChatHealthView(APIView):
    """GET /api/chat/health/ — PROJ-29 Phase 1G AC-Ops-Obs-4 / Verification 31.

    Five-component probe for the niche-chat surface. Returns:

    - 200 ``{'status': 'ok', 'components': {<name>: 'green', ...}, 'failing': []}``
      when all 5 components healthy.
    - 503 ``{'status': 'degraded', 'components': {..., <name>: 'red'},
      'failing': ['<name>', ...]}`` when any component fails.

    Components:

    1. ``embedding_api`` — ``OPENROUTER_API_KEY`` env presence (live ping skipped
       to avoid burning OpenRouter quota on health checks).
    2. ``vane`` — HEAD ``settings.VANE_API_URL`` with a 2-second timeout. Green
       on 200 / 405 (HEAD not allowed = still reachable). Red on
       connection failure or empty config.
    3. ``pgvector_index`` — at least one GIN index on ``vector_app_embedding``
       (covers ``emb_search_gin_idx`` BM25 + ``embedding_metadata_niche_id_gin``
       JSON filter).
    4. ``redis`` — ``django_rq.get_queue('default').connection.ping()``.
    5. ``chat_node_config`` — ``ChatNodeConfig.objects.count() >= 8`` (seed
       migration ``0002_seed_node_rows`` produces 8 rows).

    Auth: ``IsAuthenticated`` — health probe is operator-facing, not public,
    and we have no public health surface for this domain.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        components: dict = {}

        # 1) Embedding API — env-presence only (avoid quota burn).
        try:
            has_key = bool(getattr(settings, 'OPENROUTER_API_KEY', '') or '')
            components['embedding_api'] = 'green' if has_key else 'red'
        except Exception:  # pragma: no cover - defensive
            components['embedding_api'] = 'red'

        # 2) Vane reachability — HEAD with a 2s budget.
        try:
            import httpx
            vane_url = (getattr(settings, 'VANE_API_URL', '') or '').strip()
            if not vane_url:
                components['vane'] = 'red'
            else:
                with httpx.Client(timeout=2.0) as client:
                    resp = client.head(vane_url.rstrip('/'))
                # 405 = method-not-allowed still proves reachability.
                components['vane'] = (
                    'green' if resp.status_code in (200, 204, 301, 302, 405)
                    else 'red'
                )
        except Exception:
            components['vane'] = 'red'

        # 3) pgvector indexes — at least one GIN/HNSW on the embedding table.
        try:
            from django.db import connection
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*) FROM pg_indexes
                    WHERE tablename = 'vector_app_embedding'
                      AND (indexdef ILIKE '%gin%' OR indexdef ILIKE '%hnsw%')
                    """,
                )
                count = cur.fetchone()[0]
            components['pgvector_index'] = 'green' if count >= 1 else 'red'
        except Exception:
            components['pgvector_index'] = 'red'

        # 4) Redis — bound queue's connection.ping().
        try:
            redis_conn = django_rq.get_queue('default').connection
            ok = bool(redis_conn.ping())
            components['redis'] = 'green' if ok else 'red'
        except Exception:
            components['redis'] = 'red'

        # 5) ChatNodeConfig — must have all 8 seeded rows.
        try:
            from chat_node_config_app.models import ChatNodeConfig
            cnt = ChatNodeConfig.objects.count()
            components['chat_node_config'] = 'green' if cnt >= 8 else 'red'
        except Exception:
            components['chat_node_config'] = 'red'

        failing = sorted([k for k, v in components.items() if v != 'green'])
        if failing:
            body = {
                'status': 'degraded',
                'components': components,
                'failing': failing,
            }
            return Response(body, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            'status': 'ok',
            'components': components,
            'failing': [],
        })

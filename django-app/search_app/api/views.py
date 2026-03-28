import json
import logging

import django_rq
from django.db.models import Count
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

from search_app.api.serializers import (
    ChatSessionCreateSerializer,
    ChatSessionDetailSerializer,
    ChatSessionListSerializer,
    ChatSessionUpdateSerializer,
    ChatTagCreateSerializer,
    ChatTagSerializer,
    SaveToNicheSerializer,
    SendMessageSerializer,
    TriggerCrawlSerializer,
    WebSearchResultSerializer,
)
from search_app.models import (
    ChatMessage,
    ChatSession,
    ChatTag,
    WebSearchResult,
)
from search_app.services.context_builder import build_system_instructions
from search_app.services.crawl_service import CrawlService
from search_app.services.vane_service import VaneService, VaneServiceError
from search_app.tasks import execute_crawl, log_search_usage

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
        tag_id = request.query_params.get('tag_id')

        qs = ChatSession.objects.filter(workspace=workspace)

        if shared == 'true':
            # Shared sessions from all workspace members
            qs = qs.filter(is_shared=True)
        else:
            # Own sessions + shared sessions
            qs = qs.filter(created_by=request.user) | qs.filter(is_shared=True)
            qs = qs.distinct()

        # Filters (AC-46)
        if niche_id:
            qs = qs.filter(niche_context_id=niche_id)
        if tag_id:
            qs = qs.filter(tags__id=tag_id)

        qs = qs.select_related('created_by', 'niche_context').prefetch_related(
            'tags'
        ).annotate(
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
            ).prefetch_related('tags', 'messages').get(
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

        if 'tag_ids' in data:
            # Validate all tags belong to workspace
            tags = ChatTag.objects.filter(
                id__in=data['tag_ids'], workspace=workspace,
            )
            session.tags.set(tags)

        return Response(ChatSessionDetailSerializer(session).data)

    def delete(self, request, session_id):
        workspace, session, err = self._get_session(request, session_id)
        if err:
            return err

        if session.created_by != request.user:
            return Response(
                {'error': 'Only the session owner can delete it.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatSessionMessagesView(APIView):
    """POST /api/chat/sessions/{id}/messages/ -- send message, triggers Vane search.
    GET /api/chat/sessions/{id}/messages/ -- paginated messages (older than 50).
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

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

        # Create user message
        user_msg = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.Role.USER,
            content=data['content'],
            message_type=ChatMessage.MessageType.SEARCH_QUERY,
            search_mode=data.get('search_mode', 'balanced'),
            search_sources=data.get('search_sources', ['web']),
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


class ChatSessionShareView(APIView):
    """POST /api/chat/sessions/{id}/share/ -- share session with workspace."""

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

        session.is_shared = True
        session.save(update_fields=['is_shared', 'updated_at'])
        return Response({'id': str(session.id), 'is_shared': True})


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

        # Enqueue crawl job
        try:
            queue = django_rq.get_queue('default')
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

        if save_as == 'notes':
            # Append to niche notes
            separator = '\n\n---\n\n' if niche.notes else ''
            source_info = f"**Source:** [{result.title or result.url}]({result.url})\n\n"
            content_preview = result.content[:2000] if result.content else result.title
            niche.notes += f"{separator}{source_info}{content_preview}"
            niche.save(update_fields=['notes', 'updated_at'])

            return Response({
                'saved': True,
                'save_as': 'notes',
                'niche_id': str(niche.id),
                'niche_name': niche.name,
            })

        elif save_as == 'keywords':
            # Save to keyword_app (PROJ-10) if available
            try:
                from keyword_app.models import NicheKeyword
                keyword = NicheKeyword.objects.create(
                    workspace=workspace,
                    niche=niche,
                    keyword=result.title[:200] if result.title else result.url[:200],
                    source='web_search',
                    notes=f"From: {result.url}",
                )
                return Response({
                    'saved': True,
                    'save_as': 'keywords',
                    'niche_id': str(niche.id),
                    'niche_name': niche.name,
                    'keyword_id': str(keyword.id),
                })
            except ImportError:
                return Response(
                    {'error': 'Keyword app not available.'},
                    status=status.HTTP_501_NOT_IMPLEMENTED,
                )
            except Exception as e:
                logger.error("Failed to save keyword: %s", e)
                return Response(
                    {'error': f'Failed to save keyword: {e}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        return Response(
            {'error': f'Unknown save_as value: {save_as}'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ChatTagListCreateView(APIView):
    """GET /api/chat/tags/ -- list workspace tags.
    POST /api/chat/tags/ -- create custom tag.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        tags = ChatTag.objects.filter(workspace=workspace).order_by('name')
        serializer = ChatTagSerializer(tags, many=True)
        return Response(serializer.data)

    def post(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        serializer = ChatTagCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Check uniqueness
        if ChatTag.objects.filter(
            workspace=workspace, name=data['name'],
        ).exists():
            return Response(
                {'error': f'Tag "{data["name"]}" already exists in this workspace.'},
                status=status.HTTP_409_CONFLICT,
            )

        tag = ChatTag.objects.create(
            workspace=workspace,
            name=data['name'],
            color=data.get('color', '#6B7280'),
            is_system=False,
            created_by=request.user,
        )

        return Response(
            ChatTagSerializer(tag).data,
            status=status.HTTP_201_CREATED,
        )


class ChatTagDeleteView(APIView):
    """DELETE /api/chat/tags/{id}/ -- delete custom tag."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, tag_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        try:
            tag = ChatTag.objects.get(pk=tag_id, workspace=workspace)
        except ChatTag.DoesNotExist:
            return Response(
                {'error': 'Tag not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # AC-47: system tags cannot be deleted
        if tag.is_system:
            return Response(
                {'error': 'System tags cannot be deleted.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tag.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SearchHealthView(APIView):
    """GET /api/search/health/ -- check Vane + Crawl4ai status."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vane = VaneService()
        crawl = CrawlService()

        vane_status = 'online' if vane.health_check() else 'offline'
        crawl_status = 'online' if crawl.health_check() else 'offline'

        return Response({
            'vane': vane_status,
            'crawl4ai': crawl_status,
        })

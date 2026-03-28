import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership
from vector_app.api.serializers import SemanticSearchRequestSerializer
from vector_app.services import EmbeddingService

logger = logging.getLogger(__name__)


class SemanticSearchThrottle(UserRateThrottle):
    """30 req/min per user -- protects OpenRouter embedding cost."""
    scope = 'semantic_search'


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


class SemanticSearchView(APIView):
    """POST /api/search/semantic/ -- generic semantic search across all content types."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [SemanticSearchThrottle]

    def post(self, request):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        serializer = SemanticSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        service = EmbeddingService()

        try:
            results = service.search(
                query=data['query'],
                workspace_id=workspace.id,
                content_types=data.get('content_types'),
                top_k=data['top_k'],
                threshold=data['threshold'],
                strategy=data['strategy'],
            )
        except Exception:
            logger.exception("Semantic search failed")
            return Response(
                {'error': 'Search failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'results': results,
            'total': len(results),
            'query': data['query'],
            'strategy': data['strategy'],
        })


class NicheSimilarView(APIView):
    """GET /api/niches/{id}/similar/ -- top 10 similar niches."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [SemanticSearchThrottle]

    def get(self, request, niche_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        # Verify niche belongs to workspace
        from niche_app.models import Niche
        try:
            niche = Niche.objects.get(pk=niche_id, workspace=workspace)
        except Niche.DoesNotExist:
            return Response(
                {'error': 'Niche not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Use NicheAnalysis embedding text if available, fallback to Niche
        query_text = None
        analyses = niche.niche_analyses.order_by('-created_at')[:1]
        if analyses:
            analysis = analyses[0]
            if hasattr(analysis, 'get_embedding_text'):
                query_text = analysis.get_embedding_text()

        if not query_text:
            if hasattr(niche, 'get_embedding_text'):
                query_text = niche.get_embedding_text()

        if not query_text:
            query_text = niche.name

        service = EmbeddingService()
        try:
            results = service.search(
                query=query_text,
                workspace_id=workspace.id,
                content_types=['niche', 'niche_analysis'],
                top_k=11,  # +1 because the niche itself may be in results
                threshold=0.3,
            )
        except Exception:
            logger.exception("Similar niche search failed")
            return Response(
                {'error': 'Search failed.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Exclude the queried niche itself from results
        results = [
            r for r in results
            if r['object_id'] != str(niche_id)
        ][:10]

        return Response({
            'results': results,
            'total': len(results),
            'niche_id': str(niche_id),
        })


class IdeaSimilarView(APIView):
    """GET /api/ideas/{id}/similar/ -- top 10 similar ideas across niches."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [SemanticSearchThrottle]

    def get(self, request, idea_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        # Idea model doesn't exist yet (PROJ-8). Return empty for now.
        return Response({
            'results': [],
            'total': 0,
            'idea_id': str(idea_id),
            'message': 'Idea model not yet available (PROJ-8).',
        })


class NicheRelatedContentView(APIView):
    """GET /api/niches/{id}/related-content/ -- mixed related content."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [SemanticSearchThrottle]

    def get(self, request, niche_id):
        workspace, err = _resolve_workspace(request)
        if err:
            return err

        from niche_app.models import Niche
        try:
            niche = Niche.objects.get(pk=niche_id, workspace=workspace)
        except Niche.DoesNotExist:
            return Response(
                {'error': 'Niche not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Build query text from niche + analysis
        query_text = niche.name
        if hasattr(niche, 'get_embedding_text'):
            query_text = niche.get_embedding_text() or query_text

        service = EmbeddingService()
        try:
            results = service.search(
                query=query_text,
                workspace_id=workspace.id,
                top_k=20,
                threshold=0.3,
            )
        except Exception:
            logger.exception("Related content search failed")
            return Response(
                {'error': 'Search failed.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'results': results,
            'total': len(results),
            'niche_id': str(niche_id),
        })

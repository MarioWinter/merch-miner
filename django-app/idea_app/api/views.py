"""DRF views for idea_app API."""

import json
import logging

import django_rq
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from idea_app.api.serializers import (
    AdaptTriggerSerializer,
    BulkStatusSerializer,
    ExtractSloganSerializer,
    IdeaAdaptationRunSerializer,
    IdeaCreateSerializer,
    IdeaFilterTemplateSerializer,
    IdeaImportSerializer,
    IdeaSerializer,
    IdeaUpdateSerializer,
    ImproveSerializer,
    NicheSuggestionSerializer,
)
from idea_app.models import Idea, IdeaAdaptationRun, IdeaFilterTemplate

logger = logging.getLogger(__name__)


class LLMEndpointThrottle(UserRateThrottle):
    """Rate limit for endpoints that make synchronous LLM calls."""

    rate = '10/minute'


class IdeaPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _require_workspace(request):
    """Resolve workspace ID from header or user's first active membership."""
    ws_id = request.headers.get('X-Workspace-Id')
    if ws_id:
        return ws_id
    # Fallback: first active membership (same pattern as niche_app)
    from workspace_app.models import Membership

    membership = (
        Membership.objects
        .filter(user=request.user, status=Membership.Status.ACTIVE)
        .select_related('workspace')
        .first()
    )
    if membership:
        return str(membership.workspace_id)
    return None


def _ws_error():
    return Response(
        {'error': 'No workspace found. Set X-Workspace-Id header or join a workspace.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


def _parse_llm_json(content, expect_array=False):
    """Try to parse JSON from LLM response, with fallback extraction."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    # Fallback: extract JSON from surrounding text
    if expect_array:
        start, end = content.find('['), content.rfind(']') + 1
    else:
        start, end = content.find('{'), content.rfind('}') + 1
    if start >= 0 and end > start:
        return json.loads(content[start:end])
    return None


class IdeaListCreateView(APIView):
    """GET: list ideas for a niche. POST: create manual idea(s)."""

    def get(self, request, niche_id):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        ideas = Idea.objects.filter(
            workspace_id=workspace_id,
            niche_id=niche_id,
        ).select_related('source_idea', 'niche')

        paginator = IdeaPagination()
        page = paginator.paginate_queryset(ideas, request)
        serializer = IdeaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, niche_id):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        serializer = IdeaCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        slogan_text = serializer.validated_data['slogan_text']
        source_product_url = serializer.validated_data.get('source_product_url', '')

        # Support batch: split by newlines
        lines = [line.strip() for line in slogan_text.split('\n') if line.strip()]

        created_ideas = []
        for line in lines:
            idea = Idea.objects.create(
                workspace_id=workspace_id,
                niche_id=niche_id,
                slogan_text=line,
                is_manual=True,
                source_product_url=source_product_url,
                created_by=request.user,
            )
            created_ideas.append(idea)

        result = IdeaSerializer(created_ideas, many=True)
        return Response(result.data, status=status.HTTP_201_CREATED)


class IdeaDetailView(APIView):
    """PATCH: update idea. DELETE: hard delete."""

    def patch(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        idea = get_object_or_404(Idea, pk=pk, workspace_id=workspace_id)
        serializer = IdeaUpdateSerializer(idea, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(IdeaSerializer(idea).data)

    def delete(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        idea = get_object_or_404(Idea, pk=pk, workspace_id=workspace_id)
        idea.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IdeaAdaptView(APIView):
    """POST: trigger adaptation run for a source idea."""

    def post(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        idea = get_object_or_404(Idea, pk=pk, workspace_id=workspace_id)

        if not idea.niche_id:
            return Response(
                {'error': 'Source idea must have a niche before adaptation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Block duplicate pending/running runs
        existing = IdeaAdaptationRun.objects.filter(
            source_idea=idea,
            status__in=[
                IdeaAdaptationRun.Status.PENDING,
                IdeaAdaptationRun.Status.RUNNING,
            ],
        ).exists()
        if existing:
            return Response(
                {'error': 'An adaptation run is already pending or running for this idea.'},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = AdaptTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_niche_ids = [
            str(uid) for uid in serializer.validated_data['target_niche_ids']
        ]

        run = IdeaAdaptationRun.objects.create(
            workspace_id=workspace_id,
            source_idea=idea,
            target_niche_ids=target_niche_ids,
            triggered_by=request.user,
        )

        from idea_app.tasks import run_idea_adaptation

        queue = django_rq.get_queue('slogan')
        job = queue.enqueue(run_idea_adaptation, str(run.id))
        run.rq_job_id = job.id
        run.save(update_fields=['rq_job_id'])

        return Response(
            IdeaAdaptationRunSerializer(run).data,
            status=status.HTTP_201_CREATED,
        )


class AdaptationRunDetailView(APIView):
    """GET: poll adaptation run status."""

    def get(self, request, run_id):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        run = get_object_or_404(
            IdeaAdaptationRun, pk=run_id, workspace_id=workspace_id,
        )
        return Response(IdeaAdaptationRunSerializer(run).data)


class IdeaImproveView(APIView):
    """POST: improve a slogan -- single LLM call returns 3 variants."""

    throttle_classes = [LLMEndpointThrottle]

    def post(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        idea = get_object_or_404(Idea, pk=pk, workspace_id=workspace_id)

        serializer = ImproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback = serializer.validated_data.get('feedback', '')

        try:
            from idea_app.graph.llm import get_slogan_llm
            from langchain_core.messages import HumanMessage, SystemMessage

            llm, _ = get_slogan_llm('quality_check')

            niche_name = idea.niche.name if idea.niche else 'unknown'
            prompt = (
                f"Improve this slogan for the niche '{niche_name}'.\n\n"
                f"Original: {idea.slogan_text}\n"
            )
            if feedback:
                prompt += f"User feedback: {feedback}\n"
            prompt += (
                "\nGenerate exactly 3 improved variants. Return JSON array of "
                "objects with keys: slogan_text, why_it_works, signal_type "
                "(SELF or OTHER), market_confidence (High/Medium/Low)."
            )

            messages = [
                SystemMessage(
                    content="You improve POD slogans. Return valid JSON only.",
                ),
                HumanMessage(content=prompt),
            ]

            response = llm.invoke(messages)
            variants = _parse_llm_json(response.content, expect_array=True)
            if variants is None:
                return Response(
                    {'error': 'Failed to parse LLM response.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            created = []
            valid_confidence = {'High', 'Medium', 'Low'}
            for v in variants[:3]:
                confidence = v.get('market_confidence')
                new_idea = Idea.objects.create(
                    workspace_id=workspace_id,
                    niche=idea.niche,
                    source_idea=idea,
                    slogan_text=v.get('slogan_text', ''),
                    is_manual=False,
                    signal_type=v.get('signal_type', '').lower() or None,
                    why_it_works=v.get('why_it_works', ''),
                    market_confidence=(
                        confidence if confidence in valid_confidence else None
                    ),
                    status=Idea.Status.FOR_REVIEW,
                    created_by=request.user,
                )
                created.append(new_idea)

            return Response(
                IdeaSerializer(created, many=True).data,
                status=status.HTTP_201_CREATED,
            )

        except Exception:
            logger.exception("Improve failed for idea %s", pk)
            return Response(
                {'error': 'Improve failed. Check server logs.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class IdeaRegenerateView(APIView):
    """POST: regenerate a rejected slogan in-place."""

    throttle_classes = [LLMEndpointThrottle]

    def post(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        idea = get_object_or_404(Idea, pk=pk, workspace_id=workspace_id)

        if idea.status != Idea.Status.REJECTED:
            return Response(
                {'error': 'Only rejected ideas can be regenerated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from idea_app.graph.llm import get_slogan_llm
            from langchain_core.messages import HumanMessage, SystemMessage

            llm, _ = get_slogan_llm('adapt_slogans')

            niche_name = idea.niche.name if idea.niche else 'unknown'
            prompt = (
                f"Generate 1 new slogan for the niche '{niche_name}'.\n"
                f"Signal type: {idea.signal_type or 'SELF'}\n"
                f"Pattern: {idea.pattern_used}\n"
                f"The previous slogan was rejected: {idea.slogan_text}\n\n"
                "Return JSON with: slogan_text, why_it_works, "
                "market_confidence (High/Medium/Low)."
            )

            messages = [
                SystemMessage(
                    content="You generate POD slogans. Return valid JSON only.",
                ),
                HumanMessage(content=prompt),
            ]

            response = llm.invoke(messages)
            result = _parse_llm_json(response.content, expect_array=False)
            if result is None:
                return Response(
                    {'error': 'Failed to parse LLM response.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            valid_confidence = {'High', 'Medium', 'Low'}
            confidence = result.get('market_confidence')

            idea.slogan_text = result.get('slogan_text', idea.slogan_text)
            idea.why_it_works = result.get('why_it_works', '')
            idea.market_confidence = (
                confidence if confidence in valid_confidence
                else idea.market_confidence
            )
            idea.status = Idea.Status.FOR_REVIEW
            idea.was_changed = True
            idea.change_reason = 'Regenerated after rejection'
            idea.save()

            return Response(IdeaSerializer(idea).data)

        except Exception:
            logger.exception("Regenerate failed for idea %s", pk)
            return Response(
                {'error': 'Regenerate failed. Check server logs.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ExtractSloganView(APIView):
    """POST: extract slogan text from product image via Vision LLM."""

    throttle_classes = [LLMEndpointThrottle]

    def post(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        serializer = ExtractSloganSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image_url = serializer.validated_data['product_image_url']
        title = serializer.validated_data.get('product_title', '')
        brand = serializer.validated_data.get('product_brand', '')

        try:
            from idea_app.graph.llm import get_slogan_llm
            from langchain_core.messages import HumanMessage, SystemMessage

            llm, _ = get_slogan_llm('analyze_original')

            prompt = (
                f"Extract the slogan/text from this product image.\n"
                f"Product title: {title}\n"
                f"Product brand: {brand}\n"
                f"Image URL: {image_url}\n\n"
                "Return ONLY the slogan text, nothing else. "
                "If no text visible, return 'NO_TEXT_FOUND'."
            )

            messages = [
                SystemMessage(
                    content="You extract text from product images. Return only the text.",
                ),
                HumanMessage(content=[
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ]),
            ]

            response = llm.invoke(messages)
            slogan_text = response.content.strip()

            return Response({'slogan_text': slogan_text})

        except Exception:
            logger.exception("Extract slogan failed")
            return Response(
                {'error': 'Extract failed. Check server logs.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class IdeaSuggestNichesView(APIView):
    """GET: suggest compatible target niches for adaptation."""

    def get(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        idea = get_object_or_404(Idea, pk=pk, workspace_id=workspace_id)

        if not idea.niche_id:
            return Response(
                {'error': 'Idea must have a niche to suggest targets.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from niche_app.models import Niche
        from niche_research_app.models import NicheAnalysis

        # All active workspace niches except source
        niches = Niche.objects.filter(
            workspace_id=workspace_id,
        ).exclude(
            id=idea.niche_id,
        ).exclude(
            status='archived',
        )

        # Niches already successfully adapted from this idea
        existing_runs = IdeaAdaptationRun.objects.filter(
            source_idea=idea,
            status=IdeaAdaptationRun.Status.COMPLETED,
        )
        already_adapted_ids = set()
        for run in existing_runs:
            for niche_id, result in (run.niche_results or {}).items():
                if result.get('approval_status') == 'APPROVED' or result.get('status') == 'completed':
                    already_adapted_ids.add(niche_id)

        # Source niche pattern data
        source_analysis = NicheAnalysis.objects.filter(
            niche=idea.niche,
        ).order_by('-created_at').first()

        source_patterns = set()
        if source_analysis and source_analysis.pattern_analysis:
            source_patterns = {
                p['name'] for p in source_analysis.pattern_analysis
                if p.get('present')
            }

        from niche_research_app.models import NicheResearch

        # Prefetch latest completed research per niche
        completed_research_niche_ids = set(
            NicheResearch.objects.filter(
                niche__in=niches,
                status='completed',
            ).values_list('niche_id', flat=True),
        )

        suggestions = []
        for niche in niches:
            target_analysis = NicheAnalysis.objects.filter(
                niche=niche,
            ).order_by('-created_at').first()

            shared = []
            score = 50  # base
            if target_analysis and target_analysis.pattern_analysis:
                target_patterns = {
                    p['name'] for p in target_analysis.pattern_analysis
                    if p.get('present')
                }
                shared = list(source_patterns & target_patterns)
                if source_patterns:
                    overlap_ratio = len(shared) / len(source_patterns)
                    score = int(50 + overlap_ratio * 50)

            suggestions.append({
                'niche_id': str(niche.id),
                'niche_name': niche.name,
                'compatibility_score': score,
                'shared_patterns': shared[:5],
                'already_adapted': str(niche.id) in already_adapted_ids,
                'has_completed_research': niche.id in completed_research_niche_ids,
                'research_status': niche.research_status,
            })

        suggestions.sort(key=lambda x: x['compatibility_score'], reverse=True)

        result_serializer = NicheSuggestionSerializer(suggestions, many=True)
        return Response(result_serializer.data)


class IdeaBulkStatusView(APIView):
    """POST: bulk update idea status."""

    def post(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        serializer = BulkStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ids = serializer.validated_data['ids']
        new_status = serializer.validated_data['status']

        updated = Idea.objects.filter(
            id__in=ids,
            workspace_id=workspace_id,
        ).update(status=new_status)

        return Response({'updated': updated})


class IdeaWorkspaceListCreateView(APIView):
    """GET: workspace-wide idea list with filters. POST: create idea (niche optional)."""

    ALLOWED_ORDERING = {
        'created_at', '-created_at', 'slogan_text', '-slogan_text',
        'status', '-status', 'signal_type', '-signal_type',
    }

    def get(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        qs = Idea.objects.filter(
            workspace_id=workspace_id,
        ).select_related('source_idea', 'niche')

        # Filters
        niche_id = request.query_params.get('niche_id')
        if niche_id:
            qs = qs.filter(niche_id=niche_id)

        idea_status = request.query_params.get('status')
        if idea_status:
            qs = qs.filter(status=idea_status)

        signal_type = request.query_params.get('signal_type')
        if signal_type:
            qs = qs.filter(signal_type=signal_type)

        is_orphan = request.query_params.get('is_orphan')
        if is_orphan and is_orphan.lower() == 'true':
            qs = qs.filter(niche__isnull=True)

        ordering = request.query_params.get('ordering')
        if ordering and ordering in self.ALLOWED_ORDERING:
            qs = qs.order_by(ordering)

        paginator = IdeaPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = IdeaSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        serializer = IdeaCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        slogan_text = serializer.validated_data['slogan_text']
        niche_id = serializer.validated_data.get('niche')
        source_product_url = serializer.validated_data.get('source_product_url', '')

        lines = [line.strip() for line in slogan_text.split('\n') if line.strip()]

        created_ideas = []
        for line in lines:
            idea = Idea.objects.create(
                workspace_id=workspace_id,
                niche_id=niche_id,
                slogan_text=line,
                is_manual=True,
                source_product_url=source_product_url,
                created_by=request.user,
            )
            created_ideas.append(idea)

        result = IdeaSerializer(created_ideas, many=True)
        return Response(result.data, status=status.HTTP_201_CREATED)


class IdeaImportView(APIView):
    """POST: batch import ideas from parsed CSV/XLSX data."""

    def post(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        serializer = IdeaImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data['ideas']

        # Pre-fetch workspace niches for name matching
        from niche_app.models import Niche
        niches = Niche.objects.filter(workspace_id=workspace_id)
        niche_map = {n.name.lower(): n for n in niches}

        warnings = []
        unmatched_names = {}  # name -> count
        created_count = 0

        for item in items:
            niche = None
            niche_name = item.get('niche_name', '').strip()
            if niche_name:
                niche = niche_map.get(niche_name.lower())
                if not niche:
                    unmatched_names[niche_name] = unmatched_names.get(niche_name, 0) + 1

            Idea.objects.create(
                workspace_id=workspace_id,
                niche=niche,
                slogan_text=item['slogan_text'],
                is_manual=True,
                created_by=request.user,
            )
            created_count += 1

        for name, count in unmatched_names.items():
            warnings.append(
                f"Niche '{name}' not found — {count} idea(s) created without niche",
            )

        return Response(
            {'created': created_count, 'warnings': warnings},
            status=status.HTTP_201_CREATED,
        )


class IdeaFilterTemplateListCreateView(APIView):
    """GET: list filter templates. POST: create one."""

    def get(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        templates = IdeaFilterTemplate.objects.filter(workspace_id=workspace_id)
        serializer = IdeaFilterTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    def post(self, request):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        serializer = IdeaFilterTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(workspace_id=workspace_id, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class IdeaFilterTemplateDetailView(APIView):
    """PATCH: update filter template. DELETE: remove it."""

    def patch(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        template = get_object_or_404(
            IdeaFilterTemplate, pk=pk, workspace_id=workspace_id,
        )
        serializer = IdeaFilterTemplateSerializer(
            template, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        workspace_id = _require_workspace(request)
        if not workspace_id:
            return _ws_error()

        template = get_object_or_404(
            IdeaFilterTemplate, pk=pk, workspace_id=workspace_id,
        )
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

"""Progress tracking decorator for LangGraph nodes."""

import functools
import logging

from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class ResearchCancelledError(RuntimeError):
    """Raised when a research run has been cancelled by the user."""

    def __init__(self, research_id: str):
        super().__init__(f"Research {research_id} cancelled by user")
        self.research_id = research_id


def update_node_progress(node_name: str):
    """Decorator that tracks node progress on NicheResearch record.

    - Entry: checks if cancelled, then sets current_node
    - Success exit: appends to completed_nodes, clears current_node
    - Error exit: clears current_node only
    """

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(state, *args, **kwargs):
            research_id = state['research_id']

            @sync_to_async
            def _check_cancelled():
                from niche_research_app.models import NicheResearch

                try:
                    return NicheResearch.objects.values_list(
                        'cancelled', flat=True,
                    ).get(id=research_id)
                except NicheResearch.DoesNotExist:
                    return False

            @sync_to_async
            def _set_current():
                from niche_research_app.models import NicheResearch

                NicheResearch.objects.filter(id=research_id).update(
                    current_node=node_name,
                )

            @sync_to_async
            def _mark_completed():
                from niche_research_app.models import NicheResearch

                research = NicheResearch.objects.get(id=research_id)
                completed = list(research.completed_nodes or [])
                if node_name not in completed:
                    completed.append(node_name)
                research.completed_nodes = completed
                research.current_node = ''
                research.save(update_fields=['completed_nodes', 'current_node'])

            @sync_to_async
            def _clear_current():
                from niche_research_app.models import NicheResearch

                NicheResearch.objects.filter(id=research_id).update(
                    current_node='',
                )

            # Check cancellation before doing any work
            if await _check_cancelled():
                logger.info(
                    "Research %s cancelled, stopping at node %s",
                    research_id, node_name,
                )
                raise ResearchCancelledError(research_id)

            await _set_current()
            try:
                result = await func(state, *args, **kwargs)
                await _mark_completed()
                return result
            except Exception:
                await _clear_current()
                raise

        return wrapper

    return decorator


async def get_completed_nodes(research_id: str) -> list[str]:
    """Read completed_nodes from DB (not from state, which may be empty on resume)."""

    @sync_to_async
    def _read():
        from niche_research_app.models import NicheResearch

        try:
            research = NicheResearch.objects.get(id=research_id)
            return list(research.completed_nodes or [])
        except NicheResearch.DoesNotExist:
            return []

    return await _read()

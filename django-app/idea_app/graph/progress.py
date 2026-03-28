"""Progress tracking decorator for LangGraph slogan nodes."""
import functools
import logging

from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class AdaptationCancelledError(RuntimeError):
    """Raised when an adaptation run has been cancelled."""

    def __init__(self, run_id: str):
        super().__init__(f"Adaptation run {run_id} cancelled")
        self.run_id = run_id


def update_node_progress(node_name: str):
    """Decorator that tracks node progress on IdeaAdaptationRun record."""

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(state, *args, **kwargs):
            run_id = state["run_id"]

            @sync_to_async
            def _set_current():
                from idea_app.models import IdeaAdaptationRun

                IdeaAdaptationRun.objects.filter(id=run_id).update(
                    current_node=node_name,
                )

            @sync_to_async
            def _mark_completed():
                from idea_app.models import IdeaAdaptationRun

                run = IdeaAdaptationRun.objects.get(id=run_id)
                completed = list(run.completed_nodes or [])
                if node_name not in completed:
                    completed.append(node_name)
                run.completed_nodes = completed
                run.current_node = ""
                run.save(update_fields=["completed_nodes", "current_node"])

            @sync_to_async
            def _clear_current():
                from idea_app.models import IdeaAdaptationRun

                IdeaAdaptationRun.objects.filter(id=run_id).update(current_node="")

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


async def get_completed_nodes(run_id: str) -> list[str]:
    """Read completed_nodes from DB."""

    @sync_to_async
    def _read():
        from idea_app.models import IdeaAdaptationRun

        try:
            run = IdeaAdaptationRun.objects.get(id=run_id)
            return list(run.completed_nodes or [])
        except IdeaAdaptationRun.DoesNotExist:
            return []

    return await _read()

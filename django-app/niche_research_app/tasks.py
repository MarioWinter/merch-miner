"""django-rq task for running niche research LangGraph workflow."""

import asyncio
import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_langfuse_handler(research_id: str, niche_name: str):
    """Return Langfuse CallbackHandler if configured, else None.

    langfuse v4: initialize Langfuse client first, then create CallbackHandler
    with trace_context for custom trace IDs.
    """
    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        return None
    try:
        from langfuse import Langfuse
        from langfuse.langchain import CallbackHandler

        # Initialize singleton client with credentials
        Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )

        return CallbackHandler()
    except ImportError:
        logger.warning("langfuse package not installed, skipping tracing")
        return None


def run_niche_research(research_id: str):
    """Sync entry point for django-rq. Runs the async graph via asyncio.run()."""
    from niche_research_app.models import NicheResearch, ResearchNodeConfig

    try:
        research = NicheResearch.objects.select_related('niche').get(id=research_id)
    except NicheResearch.DoesNotExist:
        logger.error("NicheResearch %s not found", research_id)
        return

    # Snapshot config at run start
    configs = ResearchNodeConfig.objects.all()
    config_snapshot = {
        c.node_name: {
            'model_name': c.model_name,
            'temperature': c.temperature,
            'max_tokens': c.max_tokens,
            'system_prompt': (
                c.system_prompt[:200] + '...'
                if len(c.system_prompt) > 200
                else c.system_prompt
            ),
        }
        for c in configs
    }
    research.config_snapshot = config_snapshot
    research.save(update_fields=['config_snapshot'])

    niche_name = research.niche.name
    marketplace = research.marketplace or 'amazon_com'
    product_type = research.product_type or 't_shirt'
    retry_count = research.retry_count

    langfuse_handler = _get_langfuse_handler(str(research_id), niche_name)

    async def _run():
        """Async inner function: set up checkpointer and run graph."""
        from niche_research_app.graph.workflow import compile_and_run

        try:
            db_config = settings.DATABASES['default']
            db_uri = (
                f"postgresql://{db_config['USER']}:{db_config['PASSWORD']}"
                f"@{db_config['HOST']}:{db_config['PORT']}/{db_config['NAME']}"
            )
            schema = db_config.get('OPTIONS', {}).get('options', '')
            # Extract schema name from search_path
            if 'search_path=' in schema:
                schema_name = schema.split('search_path=')[1].split(',')[0]
            else:
                schema_name = 'public'

            if schema_name and schema_name != 'public':
                db_uri += f"?options=-c%20search_path%3D{schema_name}%2Cpublic"

            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

            async with AsyncPostgresSaver.from_conn_string(db_uri) as saver:
                await saver.setup()
                await compile_and_run(
                    research_id=str(research_id),
                    niche_name=niche_name,
                    marketplace=marketplace,
                    product_type=product_type,
                    retry_count=retry_count,
                    checkpointer=saver,
                    callbacks=[langfuse_handler] if langfuse_handler else None,
                )
        except ImportError:
            logger.warning(
                "AsyncPostgresSaver not available, running without checkpointer",
            )
            await compile_and_run(
                research_id=str(research_id),
                niche_name=niche_name,
                marketplace=marketplace,
                product_type=product_type,
                retry_count=retry_count,
                callbacks=[langfuse_handler] if langfuse_handler else None,
            )

    try:
        asyncio.run(_run())
    except Exception as exc:
        logger.exception("Research %s failed: %s", research_id, exc)
        try:
            research.refresh_from_db()
            if research.status != NicheResearch.Status.COMPLETED:
                research.status = NicheResearch.Status.FAILED
                research.error_message = str(exc)[:2000]
                research.completed_at = timezone.now()
                research.save(
                    update_fields=['status', 'error_message', 'completed_at'],
                )

                # Update niche research_status
                niche = research.niche
                niche.research_status = None
                niche.save(update_fields=['research_status'])
        except Exception:
            logger.exception(
                "Failed to mark research %s as failed", research_id,
            )
    finally:
        if langfuse_handler:
            try:
                from langfuse import get_client

                get_client().flush()
            except Exception:
                logger.warning("Failed to flush Langfuse client")

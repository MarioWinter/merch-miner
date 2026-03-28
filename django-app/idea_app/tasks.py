"""django-rq tasks for running slogan adaptation LangGraph workflows."""

import asyncio
import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_langfuse_handler(run_id: str):
    """Return Langfuse CallbackHandler if configured, else None."""
    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        return None
    try:
        from langfuse import Langfuse
        from langfuse.langchain import CallbackHandler

        Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )
        return CallbackHandler()
    except ImportError:
        logger.warning("langfuse package not installed, skipping tracing")
        return None


def _get_db_uri() -> str:
    """Build PostgreSQL URI from Django settings."""
    db_config = settings.DATABASES['default']
    db_uri = (
        f"postgresql://{db_config['USER']}:{db_config['PASSWORD']}"
        f"@{db_config['HOST']}:{db_config['PORT']}/{db_config['NAME']}"
    )
    schema = db_config.get('OPTIONS', {}).get('options', '')
    if 'search_path=' in schema:
        schema_name = schema.split('search_path=')[1].split(',')[0]
    else:
        schema_name = 'public'
    if schema_name and schema_name != 'public':
        db_uri += f"?options=-c%20search_path%3D{schema_name}%2Cpublic"
    return db_uri


def run_idea_adaptation(run_id: str):
    """Sync entry point for django-rq. Runs the async orchestration via asyncio.run().

    Flow:
    1. Load source idea + NicheAnalysis profiles for source + targets
    2. Snapshot config
    3. Run Graph 1 (Discovery) -> get approved niches + original analysis
    4. For each approved niche: run Graph 2 (Adaptation) with Semaphore(5)
    5. INSERT Idea records for each generated slogan
    6. UPDATE IdeaAdaptationRun with results
    """
    from idea_app.models import IdeaAdaptationRun, SloganNodeConfig

    try:
        run = IdeaAdaptationRun.objects.select_related(
            'source_idea', 'source_idea__niche', 'workspace',
        ).get(id=run_id)
    except IdeaAdaptationRun.DoesNotExist:
        logger.error("IdeaAdaptationRun %s not found", run_id)
        return

    # Mark as running
    run.status = IdeaAdaptationRun.Status.RUNNING

    # Snapshot config
    configs = SloganNodeConfig.objects.all()
    run.config_snapshot = {
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
    run.save(update_fields=['status', 'config_snapshot'])

    source_idea = run.source_idea
    source_niche = source_idea.niche
    workspace = run.workspace

    langfuse_handler = _get_langfuse_handler(str(run_id))

    async def _run():
        from idea_app.graph.adaptation_graph import compile_and_run_adaptation
        from idea_app.graph.discovery_graph import compile_and_run_discovery

        # Load source niche profile
        source_profile = await _load_niche_profile(source_niche.id)

        # Load target niche profiles
        target_niches = await _build_target_niches(run.target_niche_ids)

        db_uri = _get_db_uri()

        try:
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            checkpointer_ctx = AsyncPostgresSaver.from_conn_string(db_uri)
        except ImportError:
            logger.warning("AsyncPostgresSaver not available, running without checkpointer")
            checkpointer_ctx = None

        async def _execute(saver):
            if saver:
                await saver.setup()

            # --- Graph 1: Discovery ---
            discovery_result = await compile_and_run_discovery(
                run_id=str(run_id),
                source_slogan=source_idea.slogan_text,
                source_niche_name=source_niche.name,
                source_niche_profile=source_profile,
                target_niches=target_niches,
                checkpointer=saver,
                callbacks=[langfuse_handler] if langfuse_handler else None,
            )

            original_analysis = discovery_result.get('original_analysis', {})
            # Store source_slogan in analysis for downstream use
            original_analysis['source_slogan'] = source_idea.slogan_text

            niche_evaluations = discovery_result.get('niche_evaluations', [])
            validated_products = discovery_result.get('validated_products', {})

            # Build niche_results for the run record
            niche_results = {}
            for ev in niche_evaluations:
                niche_results[ev['niche_id']] = {
                    'niche_name': ev['niche_name'],
                    'approval_status': ev['approval_status'],
                    'compatibility_score': ev.get('compatibility_score', 0),
                    'rejection_reason': ev.get('rejection_reason', ''),
                    'signal_conversion': ev.get('signal_conversion', {}),
                }

            approved = [e for e in niche_evaluations if e.get('approval_status') == 'APPROVED']

            # --- Graph 2: Adaptation (per approved niche, max 5 parallel) ---
            semaphore = asyncio.Semaphore(5)

            async def _adapt_niche(niche_eval):
                async with semaphore:
                    niche_id = niche_eval['niche_id']
                    niche_name = niche_eval['niche_name']
                    products = validated_products.get(niche_id, [])

                    try:
                        result = await compile_and_run_adaptation(
                            run_id=str(run_id),
                            niche_id=niche_id,
                            niche_name=niche_name,
                            original_analysis=original_analysis,
                            niche_context=niche_eval,
                            validated_products=products,
                            checkpointer=saver,
                            callbacks=[langfuse_handler] if langfuse_handler else None,
                        )

                        checked_slogans = result.get('checked_slogans', [])
                        raw_slogans = result.get('raw_slogans', [])

                        # Merge quality check results with raw slogan metadata
                        await _save_ideas(
                            run=run,
                            workspace=workspace,
                            niche_id=niche_id,
                            source_idea=source_idea,
                            raw_slogans=raw_slogans,
                            checked_slogans=checked_slogans,
                        )

                        niche_results[niche_id]['ideas_created'] = len(checked_slogans) or len(raw_slogans)
                        niche_results[niche_id]['status'] = 'completed'

                    except Exception as exc:
                        logger.exception("Adaptation failed for niche %s", niche_name)
                        niche_results[niche_id]['status'] = 'failed'
                        niche_results[niche_id]['error'] = str(exc)[:500]

            if approved:
                tasks = [_adapt_niche(ev) for ev in approved]
                await asyncio.gather(*tasks)

            return niche_results

        if checkpointer_ctx:
            async with checkpointer_ctx as saver:
                return await _execute(saver)
        else:
            return await _execute(None)

    try:
        niche_results = asyncio.run(_run())

        run.refresh_from_db()
        run.niche_results = niche_results
        run.status = IdeaAdaptationRun.Status.COMPLETED
        run.completed_at = timezone.now()
        run.save(update_fields=['niche_results', 'status', 'completed_at'])

    except Exception as exc:
        logger.exception("Adaptation run %s failed: %s", run_id, exc)
        try:
            run.refresh_from_db()
            if run.status != IdeaAdaptationRun.Status.COMPLETED:
                run.status = IdeaAdaptationRun.Status.FAILED
                run.error_message = str(exc)[:2000]
                run.completed_at = timezone.now()
                run.save(update_fields=['status', 'error_message', 'completed_at'])
        except Exception:
            logger.exception("Failed to mark run %s as failed", run_id)
    finally:
        if langfuse_handler:
            try:
                from langfuse import get_client
                get_client().flush()
            except Exception:
                logger.warning("Failed to flush Langfuse client")


async def _load_niche_profile(niche_id) -> dict | None:
    """Load latest NicheAnalysis for a niche."""
    from asgiref.sync import sync_to_async
    from niche_research_app.models import NicheAnalysis

    @sync_to_async
    def _load():
        analysis = NicheAnalysis.objects.filter(niche_id=niche_id).order_by('-created_at').first()
        if not analysis:
            return None
        return {
            'niche_summary': analysis.niche_summary,
            'sentiment': analysis.sentiment,
            'primary_emotions': analysis.primary_emotions,
            'emotional_archetype': analysis.emotional_archetype,
            'pattern_analysis': analysis.pattern_analysis,
            'emotional_reality': analysis.emotional_reality,
            'design_concepts': analysis.design_concepts,
        }
    return await _load()


async def _build_target_niches(target_niche_ids: list) -> list[dict]:
    """Build target niche data with optional profiles."""
    from asgiref.sync import sync_to_async
    from niche_app.models import Niche

    @sync_to_async
    def _load():
        from niche_research_app.models import NicheAnalysis

        niches = Niche.objects.filter(id__in=target_niche_ids)
        result = []
        for niche in niches:
            profile = None
            analysis = NicheAnalysis.objects.filter(niche=niche).order_by('-created_at').first()
            if analysis:
                profile = {
                    'niche_summary': analysis.niche_summary,
                    'sentiment': analysis.sentiment,
                    'primary_emotions': analysis.primary_emotions,
                    'emotional_archetype': analysis.emotional_archetype,
                    'pattern_analysis': analysis.pattern_analysis,
                    'emotional_reality': analysis.emotional_reality,
                }
            result.append({
                'niche_id': str(niche.id),
                'niche_name': niche.name,
                'profile': profile,
            })
        return result
    return await _load()


async def _save_ideas(run, workspace, niche_id, source_idea, raw_slogans, checked_slogans):
    """Save generated ideas to DB, merging raw slogan metadata with quality check results."""
    from asgiref.sync import sync_to_async
    from idea_app.models import Idea

    @sync_to_async
    def _bulk_save():
        ideas = []
        # Use checked_slogans if available, fall back to raw_slogans
        slogans_to_save = checked_slogans if checked_slogans else raw_slogans

        for i, slogan_data in enumerate(slogans_to_save):
            # If quality-checked, merge with raw slogan metadata
            raw = raw_slogans[i] if i < len(raw_slogans) else {}

            if checked_slogans:
                slogan_text = slogan_data.get('corrected_text', slogan_data.get('original_text', ''))
                was_changed = slogan_data.get('was_changed', False)
                change_reason = slogan_data.get('change_reason', '')
                signal_type = slogan_data.get('signal_type', raw.get('signal_type', ''))
                market_confidence = slogan_data.get('market_confidence', raw.get('market_confidence', ''))
            else:
                slogan_text = slogan_data.get('slogan_text', '')
                was_changed = False
                change_reason = ''
                signal_type = slogan_data.get('signal_type', '')
                market_confidence = slogan_data.get('market_confidence', '')

            ideas.append(Idea(
                workspace=workspace,
                niche_id=niche_id,
                adaptation_run=run,
                source_idea=source_idea,
                slogan_text=slogan_text,
                is_manual=False,
                signal_type=signal_type.lower() if signal_type else None,
                creative_modules_used=raw.get('creative_modules_used', []),
                emotional_archetype=raw.get('emotional_archetype', ''),
                buyer_voice_pattern=raw.get('buyer_voice_pattern', ''),
                stylistic_device=raw.get('stylistic_device', ''),
                pattern_used=raw.get('pattern_used', ''),
                why_it_works=raw.get('why_it_works', ''),
                market_confidence=market_confidence if market_confidence in ('High', 'Medium', 'Low') else None,
                status=Idea.Status.FOR_REVIEW,
                was_changed=was_changed,
                change_reason=change_reason,
                created_by=run.triggered_by,
            ))

        Idea.objects.bulk_create(ideas)
        return len(ideas)

    count = await _bulk_save()
    logger.info("Saved %d ideas for niche %s (run %s)", count, niche_id, run.id)

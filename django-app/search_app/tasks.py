"""Background tasks for search_app (django-rq).

Crawl jobs run as async tasks since Crawl4ai can take 10-30s.
Usage logging is also enqueued to avoid blocking HTTP responses.
"""

import logging

from search_app.models import SearchUsageLog, WebSearchResult
from search_app.services.crawl_service import CrawlService, CrawlServiceError

logger = logging.getLogger(__name__)


def execute_crawl(web_search_result_id: str):
    """Execute a Crawl4ai deep crawl for a WebSearchResult.

    Updates the WebSearchResult record with crawled content and status.
    On success, the post_save signal triggers Vector DB embedding.
    """
    try:
        result = WebSearchResult.objects.get(pk=web_search_result_id)
    except WebSearchResult.DoesNotExist:
        logger.error("WebSearchResult %s not found, aborting crawl.", web_search_result_id)
        return

    # Mark as running
    result.crawl_status = WebSearchResult.CrawlStatus.RUNNING
    result.save(update_fields=['crawl_status'])

    service = CrawlService()

    try:
        crawl_data = service.crawl_url(result.url)
    except CrawlServiceError as e:
        result.crawl_status = WebSearchResult.CrawlStatus.FAILED
        result.error_message = str(e)
        result.save(update_fields=['crawl_status', 'error_message'])
        logger.error(
            "Crawl failed for WebSearchResult %s: %s",
            web_search_result_id, e,
        )
        return

    if not crawl_data.get('success'):
        result.crawl_status = WebSearchResult.CrawlStatus.FAILED
        result.error_message = 'Crawl4ai returned no content.'
        result.save(update_fields=['crawl_status', 'error_message'])
        logger.warning(
            "Crawl returned no content for WebSearchResult %s",
            web_search_result_id,
        )
        return

    result.content = crawl_data.get('content', '')
    result.metadata = crawl_data.get('metadata', {})
    result.content_type = WebSearchResult.ContentType.FULL_CRAWL
    result.crawl_status = WebSearchResult.CrawlStatus.COMPLETED
    result.error_message = ''
    result.save(update_fields=[
        'content', 'metadata', 'content_type', 'crawl_status', 'error_message',
    ])

    logger.info(
        "Crawl completed for WebSearchResult %s (%d chars)",
        web_search_result_id, len(result.content),
    )


def log_search_usage(
    workspace_id: str,
    user_id: int,
    action: str,
    query: str = '',
    url: str = '',
    model_used: str = '',
    tokens_used: int = None,
):
    """Create a SearchUsageLog entry. Fire-and-forget task."""
    try:
        SearchUsageLog.objects.create(
            workspace_id=workspace_id,
            user_id=user_id,
            action=action,
            query=query,
            url=url,
            model_used=model_used,
            tokens_used=tokens_used,
        )
    except Exception:
        logger.warning(
            "Failed to log search usage: %s %s",
            action, query[:100],
            exc_info=True,
        )

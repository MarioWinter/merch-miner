from unittest.mock import patch

import pytest
from django.core.cache import cache as django_cache
from rest_framework.settings import api_settings


@pytest.fixture(autouse=True)
def disable_throttling(settings):
    """Disable DRF throttling in all tests to prevent 429 interference.

    DEFAULT_THROTTLE_CLASSES is cleared so global throttles don't fire.
    Rates are set very high so any view-level throttle_classes won't block.
    Cache is cleared to reset any accumulated throttle history.
    """
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {
            'anon': '10000/day',
            'user': '10000/day',
            'avatar': '10000/day',
            'invite': '10000/day',
            'semantic_search': '10000/day',
        },
    }
    # Force DRF to re-read settings (it caches on first access)
    api_settings.reload()
    # Clear any throttle history stored in cache from previous tests
    django_cache.clear()
    yield
    api_settings.reload()


@pytest.fixture(autouse=True)
def use_fast_password_hasher(settings):
    """Use fast MD5 hasher in all tests — avoids PBKDF2 slowness in CI."""
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']


@pytest.fixture(autouse=True)
def disable_embedding_signals():
    """Prevent embedding signal handlers from enqueuing jobs during tests."""
    with patch('vector_app.signals._enqueue_create'), \
         patch('vector_app.signals._enqueue_delete'):
        yield


@pytest.fixture(autouse=True)
def disable_keyword_auto_import():
    """Prevent keyword auto-import signal from running during tests unless explicitly tested."""
    with patch('keyword_app.signals.auto_import_on_research_complete'):
        yield


@pytest.fixture(autouse=True)
def disable_dashboard_signals():
    """Prevent dashboard activity event signals from firing in unrelated tests."""
    with patch('dashboard_app.signals.on_niche_save'), \
         patch('dashboard_app.signals.on_research_save'), \
         patch('dashboard_app.signals.on_idea_save'), \
         patch('dashboard_app.signals.on_design_save'), \
         patch('dashboard_app.signals.on_listing_save'), \
         patch('dashboard_app.signals.on_upload_save'):
        yield


@pytest.fixture(autouse=True)
def disable_kanban_signals():
    """Prevent kanban signals from firing in unrelated tests."""
    with patch('kanban_app.signals.capture_niche_old_status'), \
         patch('kanban_app.signals.on_niche_save'):
        yield


@pytest.fixture(autouse=True)
def disable_search_signals():
    """Prevent search_app embedding signal from enqueuing jobs during tests."""
    with patch('search_app.signals.enqueue_embedding_on_crawl_complete'):
        yield


@pytest.fixture(autouse=True)
def disable_agent_signals():
    """Prevent agent_app KnowledgeDoc embedding signals during tests."""
    with patch('agent_app.signals.enqueue_knowledge_embedding'), \
         patch('agent_app.signals.enqueue_knowledge_embedding_delete'):
        yield

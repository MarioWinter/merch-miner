import pytest


@pytest.fixture(autouse=True)
def disable_throttling(settings):
    """Disable DRF throttling in all tests to prevent 429 interference."""
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {},
    }

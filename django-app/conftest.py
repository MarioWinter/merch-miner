import pytest


@pytest.fixture(autouse=True)
def disable_throttling(settings):
    """Disable DRF throttling in all tests to prevent 429 interference."""
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {},
    }


@pytest.fixture(autouse=True)
def use_fast_password_hasher(settings):
    """Use fast MD5 hasher in all tests — avoids PBKDF2 slowness in CI."""
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

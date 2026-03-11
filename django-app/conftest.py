import pytest


@pytest.fixture(autouse=True)
def disable_throttling(settings):
    """Disable DRF throttling in all tests to prevent 429 interference.

    DEFAULT_THROTTLE_CLASSES is cleared so global throttles don't fire.
    View-level throttle_classes are also cleared via REST_FRAMEWORK override.
    Rates are kept populated so any residual scope lookup doesn't KeyError.
    """
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {
            'anon': '10000/day',
            'user': '10000/day',
            'avatar': '10000/day',
            'invite': '10000/day',
        },
    }


@pytest.fixture(autouse=True)
def use_fast_password_hasher(settings):
    """Use fast MD5 hasher in all tests — avoids PBKDF2 slowness in CI."""
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

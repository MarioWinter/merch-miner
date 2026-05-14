"""PROJ-29 Phase 1G Verification 24 — gunicorn config sanity check.

Parses docker-compose.prod.yml and asserts the `web` service command contains
the production-required flags so accidental rollback to sync worker / 30s
timeout doesn't silently regress SSE streaming.
"""

import os

import pytest
import yaml


@pytest.fixture
def web_command() -> str:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    compose_path = os.path.join(repo_root, 'docker-compose.prod.yml')
    if not os.path.exists(compose_path):
        pytest.skip(f"docker-compose.prod.yml not found at {compose_path}")
    with open(compose_path) as f:
        compose = yaml.safe_load(f)
    cmd = compose.get('services', {}).get('web', {}).get('command', '')
    if isinstance(cmd, list):
        cmd = ' '.join(cmd)
    return cmd


def test_gunicorn_uses_gthread_worker_class(web_command):
    assert '--worker-class gthread' in web_command, \
        f"Expected --worker-class gthread in web command; got: {web_command}"


def test_gunicorn_timeout_90s(web_command):
    assert '--timeout 90' in web_command, \
        f"Expected --timeout 90 in web command; got: {web_command}"


def test_gunicorn_max_requests_recycle(web_command):
    assert '--max-requests 1000' in web_command, \
        f"Expected --max-requests 1000 in web command; got: {web_command}"
    assert '--max-requests-jitter' in web_command, \
        f"Expected --max-requests-jitter in web command; got: {web_command}"


def test_gunicorn_3_workers_8_threads(web_command):
    assert '--workers 3' in web_command, \
        f"Expected --workers 3 in web command; got: {web_command}"
    assert '--threads 8' in web_command, \
        f"Expected --threads 8 in web command; got: {web_command}"

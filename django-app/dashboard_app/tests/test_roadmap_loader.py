"""
Tests for ``dashboard_app.services.roadmap_loader``.

Covers: happy path, missing file, malformed YAML, items with missing required
fields, and ``items: null`` edge case. Uses ``monkeypatch`` to redirect the
loader's BASE_DIR-derived path to ``tmp_path``.
"""
from __future__ import annotations

import logging
from pathlib import Path

import pytest

from dashboard_app.services import roadmap_loader


@pytest.fixture(autouse=True)
def clear_memo():
    """Reset the loader's process-level memo between tests."""
    roadmap_loader._memo.clear()
    yield
    roadmap_loader._memo.clear()


@pytest.fixture
def fake_roadmap_path(tmp_path, monkeypatch):
    """
    Redirect ``roadmap_loader._roadmap_path()`` to a per-test tmp file.

    Returns the Path object; tests write contents to it.
    """
    target = tmp_path / 'roadmap_user_facing.md'
    monkeypatch.setattr(roadmap_loader, '_roadmap_path', lambda: target)
    return target


def test_happy_path_returns_three_items(fake_roadmap_path):
    fake_roadmap_path.write_text(
        '---\n'
        'items:\n'
        '  - title: "Bulk Upload"\n'
        '    description: "Upload many at once."\n'
        '    priority: high\n'
        '  - title: "Team Kanban"\n'
        '    description: "Coordinate as a team."\n'
        '    priority: medium\n'
        '  - title: "Mobile UI"\n'
        '    description: "Works on iPhone."\n'
        '---\n',
        encoding='utf-8',
    )
    items = roadmap_loader.load_roadmap()
    assert len(items) == 3
    assert items[0] == {
        'title': 'Bulk Upload',
        'description': 'Upload many at once.',
        'priority': 'high',
    }
    assert items[1]['title'] == 'Team Kanban'
    assert items[2] == {
        'title': 'Mobile UI',
        'description': 'Works on iPhone.',
    }


def test_missing_file_returns_empty_list(fake_roadmap_path, caplog):
    # fake_roadmap_path is the path but no file created.
    assert not fake_roadmap_path.exists()
    with caplog.at_level(logging.WARNING, logger=roadmap_loader.__name__):
        items = roadmap_loader.load_roadmap()
    assert items == []
    assert any('not found' in rec.message for rec in caplog.records)


def test_malformed_yaml_returns_empty_list(fake_roadmap_path, caplog):
    fake_roadmap_path.write_text(
        '---\n'
        'items:\n'
        '  - title: "Unclosed quote\n'
        '    description: oops\n'
        '   bad-indent: true\n'
        '---\n',
        encoding='utf-8',
    )
    with caplog.at_level(logging.WARNING, logger=roadmap_loader.__name__):
        items = roadmap_loader.load_roadmap()
    assert items == []
    assert any('malformed' in rec.message.lower() for rec in caplog.records)


def test_item_missing_required_field_is_dropped(fake_roadmap_path, caplog):
    fake_roadmap_path.write_text(
        '---\n'
        'items:\n'
        '  - title: "Good item"\n'
        '    description: "Has both fields."\n'
        '  - title: "Missing description"\n'
        '  - description: "Missing title"\n'
        '  - title: "Another good"\n'
        '    description: "Also fine."\n'
        '---\n',
        encoding='utf-8',
    )
    with caplog.at_level(logging.WARNING, logger=roadmap_loader.__name__):
        items = roadmap_loader.load_roadmap()
    assert len(items) == 2
    assert items[0]['title'] == 'Good item'
    assert items[1]['title'] == 'Another good'
    # Two skipped items logged.
    skipped = [r for r in caplog.records if 'missing required field' in r.message]
    assert len(skipped) == 2


def test_items_null_returns_empty_list(fake_roadmap_path):
    fake_roadmap_path.write_text(
        '---\n'
        'items: null\n'
        '---\n',
        encoding='utf-8',
    )
    assert roadmap_loader.load_roadmap() == []


def test_roadmap_last_modified_returns_utc_datetime(fake_roadmap_path):
    fake_roadmap_path.write_text(
        '---\nitems: []\n---\n',
        encoding='utf-8',
    )
    last = roadmap_loader.roadmap_last_modified()
    assert last is not None
    assert last.tzinfo is not None


def test_roadmap_last_modified_returns_none_when_missing(fake_roadmap_path):
    assert roadmap_loader.roadmap_last_modified() is None


def test_memo_returns_same_list_across_calls(fake_roadmap_path):
    fake_roadmap_path.write_text(
        '---\n'
        'items:\n'
        '  - title: "X"\n'
        '    description: "Y"\n'
        '---\n',
        encoding='utf-8',
    )
    first = roadmap_loader.load_roadmap()
    second = roadmap_loader.load_roadmap()
    # Same object identity due to mtime-keyed memo (no disk re-read).
    assert first is second

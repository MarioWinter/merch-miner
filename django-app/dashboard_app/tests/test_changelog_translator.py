"""
Tests for ``dashboard_app.services.changelog_translator``.

Covers: link-stripping, Markdown parsing (happy / missing / malformed / top_n
limit), LLM batch call (happy / count mismatch / exception), and orchestration
with Redis cache (hit, miss-success-6h-TTL, miss-failure-15min-TTL).

ChatOpenAI is mocked at the ``langchain_openai.ChatOpenAI`` import-site used by
the service module — no real OpenRouter calls.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from dashboard_app.services import changelog_translator


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_cache():
    """Wipe the Django cache between tests so cache_key collisions don't leak."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def fake_changelog_path(tmp_path, monkeypatch):
    """Redirect the loader to read from a per-test tmp file."""
    target = tmp_path / 'CHANGELOG.md'
    monkeypatch.setattr(
        changelog_translator, '_changelog_path', lambda: target,
    )
    return target


def _llm_response(text: str) -> MagicMock:
    """Build a fake LangChain AIMessage-like object with ``.content`` set."""
    msg = MagicMock()
    msg.content = text
    return msg


# ---------------------------------------------------------------------------
# _strip_commit_link
# ---------------------------------------------------------------------------

class TestStripCommitLink:
    def test_bullet_with_trailing_commit_link(self):
        line = (
            '**chat:** focus border over streaming ring '
            '([e200ab9](https://github.com/MarioWinter/merch-miner/commit/e200ab9))'
        )
        assert changelog_translator._strip_commit_link(line) == (
            '**chat:** focus border over streaming ring'
        )

    def test_bullet_without_link_is_untouched(self):
        line = 'Some bullet with no link at all'
        assert changelog_translator._strip_commit_link(line) == line

    def test_mid_line_link_left_alone(self):
        # Only trailing links are stripped — a link mid-text stays.
        line = 'See [docs](https://example.com/x) for details'
        assert changelog_translator._strip_commit_link(line) == line

    def test_empty_string(self):
        assert changelog_translator._strip_commit_link('') == ''


# ---------------------------------------------------------------------------
# load_changelog_versions
# ---------------------------------------------------------------------------

_SYNTHETIC_CHANGELOG = """# Changelog

## [0.7.1](https://github.com/x/y/compare/v0.7.0...v0.7.1) (2026-05-31)


### Bug Fixes

* **chat:** focus border fix ([abc1234](https://github.com/x/y/commit/abc1234))
* **chat:** tool-timeout false alarm ([def5678](https://github.com/x/y/commit/def5678))

## [0.7.0](https://github.com/x/y/compare/v0.6.0...v0.7.0) (2026-05-30)


### Features

* **chat:** streaming border ([111aaaa](https://github.com/x/y/commit/111aaaa))

### Documentation

* **chat:** docs update ([222bbbb](https://github.com/x/y/commit/222bbbb))

## [0.6.0](https://github.com/x/y/compare/v0.5.0...v0.6.0) (2026-05-29)


### Features

* **canvas:** rgba color picker ([333cccc](https://github.com/x/y/commit/333cccc))
"""


class TestLoadChangelogVersions:
    def test_happy_path_returns_three_versions(self, fake_changelog_path):
        fake_changelog_path.write_text(_SYNTHETIC_CHANGELOG, encoding='utf-8')
        versions = changelog_translator.load_changelog_versions()

        assert len(versions) == 3
        assert versions[0]['version'] == '0.7.1'
        assert versions[0]['date'] == '2026-05-31'
        assert versions[0]['raw_lines'] == [
            '**chat:** focus border fix',
            '**chat:** tool-timeout false alarm',
        ]
        assert versions[1]['version'] == '0.7.0'
        assert versions[1]['raw_lines'] == [
            '**chat:** streaming border',
            '**chat:** docs update',
        ]
        assert versions[2]['version'] == '0.6.0'
        assert versions[2]['raw_lines'] == [
            '**canvas:** rgba color picker',
        ]

    def test_missing_file_returns_empty_list(self, fake_changelog_path, caplog):
        assert not fake_changelog_path.exists()
        with caplog.at_level(
            logging.WARNING, logger=changelog_translator.__name__,
        ):
            versions = changelog_translator.load_changelog_versions()
        assert versions == []
        assert any('not found' in rec.message for rec in caplog.records)

    def test_malformed_no_version_headings_returns_empty(
        self, fake_changelog_path, caplog,
    ):
        fake_changelog_path.write_text(
            '# Changelog\n\nJust prose, no version headings here.\n',
            encoding='utf-8',
        )
        with caplog.at_level(
            logging.WARNING, logger=changelog_translator.__name__,
        ):
            versions = changelog_translator.load_changelog_versions()
        assert versions == []
        assert any('no parseable' in rec.message for rec in caplog.records)

    def test_top_n_limits_result(self, fake_changelog_path):
        fake_changelog_path.write_text(_SYNTHETIC_CHANGELOG, encoding='utf-8')
        versions = changelog_translator.load_changelog_versions(top_n=2)
        assert len(versions) == 2
        assert versions[0]['version'] == '0.7.1'
        assert versions[1]['version'] == '0.7.0'


# ---------------------------------------------------------------------------
# translate_lines_to_german
# ---------------------------------------------------------------------------

_CHATOPENAI_PATH = (
    'dashboard_app.services.changelog_translator.ChatOpenAI'
)


class TestTranslateLinesToGerman:
    def test_happy_path_parses_numbered_response(self):
        instance = MagicMock()
        instance.invoke.return_value = _llm_response(
            '1. Erste Verbesserung\n'
            '2. Zweite Verbesserung\n'
            '3. Dritte Verbesserung'
        )
        with patch(_CHATOPENAI_PATH, return_value=instance):
            result = changelog_translator.translate_lines_to_german(
                ['raw1', 'raw2', 'raw3'], model_name='openai/gpt-4o-mini',
            )
        assert result == [
            'Erste Verbesserung',
            'Zweite Verbesserung',
            'Dritte Verbesserung',
        ]
        instance.invoke.assert_called_once()

    def test_count_mismatch_returns_placeholders(self, caplog):
        instance = MagicMock()
        # Only 2 items returned for 3 inputs.
        instance.invoke.return_value = _llm_response(
            '1. Only one\n2. And two'
        )
        with patch(_CHATOPENAI_PATH, return_value=instance):
            with caplog.at_level(
                logging.WARNING, logger=changelog_translator.__name__,
            ):
                result = changelog_translator.translate_lines_to_german(
                    ['a', 'b', 'c'], model_name='openai/gpt-4o-mini',
                )
        assert result == [
            'Verbesserungen in dieser Version',
            'Verbesserungen in dieser Version',
            'Verbesserungen in dieser Version',
        ]
        assert any('returned' in rec.message for rec in caplog.records)

    def test_llm_exception_returns_placeholders(self, caplog):
        instance = MagicMock()
        instance.invoke.side_effect = RuntimeError('rate-limit')
        with patch(_CHATOPENAI_PATH, return_value=instance):
            with caplog.at_level(
                logging.WARNING, logger=changelog_translator.__name__,
            ):
                result = changelog_translator.translate_lines_to_german(
                    ['a', 'b'], model_name='openai/gpt-4o-mini',
                )
        assert result == [
            'Verbesserungen in dieser Version',
            'Verbesserungen in dieser Version',
        ]
        assert any('failed' in rec.message for rec in caplog.records)

    def test_empty_lines_short_circuits(self):
        # No LLM call when nothing to translate.
        with patch(_CHATOPENAI_PATH) as mock_cls:
            result = changelog_translator.translate_lines_to_german(
                [], model_name='openai/gpt-4o-mini',
            )
        assert result == []
        mock_cls.assert_not_called()


# ---------------------------------------------------------------------------
# get_translated_changelog (orchestration + cache)
# ---------------------------------------------------------------------------

class TestGetTranslatedChangelog:
    def _write_synthetic(self, path):
        path.write_text(_SYNTHETIC_CHANGELOG, encoding='utf-8')

    def test_cache_hit_skips_llm(self, fake_changelog_path):
        self._write_synthetic(fake_changelog_path)
        # Pre-seed cache under the expected key (latest version = 0.7.1).
        cached_value = [
            {'version': '0.7.1', 'date': '2026-05-31', 'items': ['from-cache']},
        ]
        cache.set('changelog_user:v0.7.1:de', cached_value, 60)

        with patch(_CHATOPENAI_PATH) as mock_cls:
            result = changelog_translator.get_translated_changelog()

        assert result == cached_value
        mock_cls.assert_not_called()

    def test_cache_miss_success_stores_with_six_hour_ttl(
        self, fake_changelog_path,
    ):
        self._write_synthetic(fake_changelog_path)
        # 5 total bullets in synthetic changelog (2 + 2 + 1).
        instance = MagicMock()
        instance.invoke.return_value = _llm_response(
            '1. Fix Eins\n'
            '2. Fix Zwei\n'
            '3. Feature Drei\n'
            '4. Docs Vier\n'
            '5. Canvas Fünf'
        )
        with patch(_CHATOPENAI_PATH, return_value=instance):
            result = changelog_translator.get_translated_changelog()

        assert len(result) == 3
        assert result[0]['version'] == '0.7.1'
        assert result[0]['items'] == ['Fix Eins', 'Fix Zwei']
        assert result[1]['version'] == '0.7.0'
        assert result[1]['items'] == ['Feature Drei', 'Docs Vier']
        assert result[2]['version'] == '0.6.0'
        assert result[2]['items'] == ['Canvas Fünf']

        stored = cache.get('changelog_user:v0.7.1:de')
        assert stored == result

        # ttl() returns remaining seconds — must be close to 6h.
        remaining = cache.ttl('changelog_user:v0.7.1:de')
        assert remaining is not None
        assert changelog_translator.SUCCESS_TTL_SECONDS - 30 <= remaining <= (
            changelog_translator.SUCCESS_TTL_SECONDS
        )

    def test_cache_miss_llm_failure_stores_placeholder_with_short_ttl(
        self, fake_changelog_path,
    ):
        self._write_synthetic(fake_changelog_path)
        instance = MagicMock()
        instance.invoke.side_effect = RuntimeError('boom')
        with patch(_CHATOPENAI_PATH, return_value=instance):
            result = changelog_translator.get_translated_changelog()

        placeholder = 'Verbesserungen in dieser Version'
        assert len(result) == 3
        # Every bullet rewritten to placeholder.
        all_items = [item for v in result for item in v['items']]
        assert all_items == [placeholder] * 5

        # Stored under the 15-min TTL.
        remaining = cache.ttl('changelog_user:v0.7.1:de')
        assert remaining is not None
        assert remaining <= changelog_translator.FAILURE_TTL_SECONDS
        assert remaining > changelog_translator.FAILURE_TTL_SECONDS - 30

    def test_no_versions_returns_empty(self, fake_changelog_path):
        # No file -> no versions -> empty list, no cache, no LLM call.
        with patch(_CHATOPENAI_PATH) as mock_cls:
            result = changelog_translator.get_translated_changelog()
        assert result == []
        mock_cls.assert_not_called()


# ---------------------------------------------------------------------------
# Phase 11 follow-up — language-aware translation
# ---------------------------------------------------------------------------

class TestLanguageAware:
    """``lang='en'`` uses the English prompt + placeholder + cache slot."""

    def _write(self, path):
        path.write_text(
            '## [0.7.1](https://example/v0.7.1) (2026-05-31)\n\n'
            '### Bug Fixes\n\n'
            '* one ([abc1234](https://example/c/abc1234))\n',
            encoding='utf-8',
        )

    def test_lang_en_uses_english_system_prompt(self, fake_changelog_path):
        self._write(fake_changelog_path)
        instance = MagicMock()
        instance.invoke.return_value = _llm_response('1. Cleaner UX\n')
        with patch(_CHATOPENAI_PATH, return_value=instance):
            result = changelog_translator.get_translated_changelog(lang='en')

        # The system message must be the EN prompt.
        called_args = instance.invoke.call_args[0][0]
        sys_msg = next(m for m in called_args if m['role'] == 'system')
        assert 'ENGLISH' in sys_msg['content']
        assert result[0]['items'] == ['Cleaner UX']

    def test_lang_en_cache_key_includes_en_suffix(self, fake_changelog_path):
        self._write(fake_changelog_path)
        instance = MagicMock()
        instance.invoke.return_value = _llm_response('1. Cleaner UX\n')
        with patch(_CHATOPENAI_PATH, return_value=instance):
            changelog_translator.get_translated_changelog(lang='en')

        # DE slot must NOT have been populated; EN slot must be present.
        assert cache.get('changelog_user:v0.7.1:de') is None
        assert cache.get('changelog_user:v0.7.1:en') is not None

    def test_lang_en_failure_uses_english_placeholder(self, fake_changelog_path):
        self._write(fake_changelog_path)
        instance = MagicMock()
        instance.invoke.side_effect = RuntimeError('boom')
        with patch(_CHATOPENAI_PATH, return_value=instance):
            result = changelog_translator.get_translated_changelog(lang='en')
        assert result[0]['items'] == ['Improvements in this version']

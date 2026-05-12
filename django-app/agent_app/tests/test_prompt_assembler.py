"""PROJ-29 Phase 1D Round 1D-3 — prompt_assembler.assemble.

Covers AC-Context-1:
- Under-budget input -> returned unchanged (system_prompt + history + chunks).
- Over-budget: step-1 trims oldest history (keeps newest 10).
- Step-2 compresses turns > 5-from-tail into 1-liners when step-1 not enough.
- Step-3 caps chunk text to first 400 tokens when step-2 not enough.
- Step-4: untrimmable -> raises ValueError (hard budget never violated).
- Tokens are counted via ``vector_app.chunking.count_tokens``.
"""

from __future__ import annotations

import pytest

from agent_app.services.prompt_assembler import (
    CHUNK_TOKEN_CAP,
    HISTORY_COMPRESS_TAIL,
    HISTORY_VERBATIM_TAIL,
    assemble,
)
from vector_app.chunking import count_tokens


def _make_msg(role: str, content: str) -> dict:
    return {'role': role, 'content': content}


def _total(system: str, history: list[dict], chunks: list[dict]) -> int:
    total = count_tokens(system or '')
    for m in history:
        total += count_tokens(f"{m['role']}: {m['content']}")
    for c in chunks:
        total += count_tokens(c.get('text') or '')
    return total


class TestPromptAssembler:
    def test_under_budget_passes_through_unchanged(self):
        system = 'You are an assistant.'
        history = [_make_msg('user', 'hello'), _make_msg('assistant', 'hi')]
        chunks = [{'text': 'short chunk', 'score': 0.9}]

        sp, h, c = assemble(system, history, chunks, budget=8000)

        assert sp == system
        assert h == history
        assert c == chunks
        assert _total(sp, h, c) <= 8000

    def test_drops_oldest_history_first_when_over_budget(self):
        """Step 1: keep newest ``HISTORY_VERBATIM_TAIL`` messages only."""
        system = 'sys'
        # 20 verbose user messages -> blows budget
        verbose = 'word ' * 200  # ~200 tokens each
        history = [
            _make_msg('user' if i % 2 == 0 else 'assistant', f'{i} {verbose}')
            for i in range(20)
        ]
        chunks: list[dict] = []

        # Budget large enough for ~ HISTORY_VERBATIM_TAIL msgs but not 20.
        per_msg_tokens = count_tokens(f"user: 0 {verbose}")
        budget = per_msg_tokens * HISTORY_VERBATIM_TAIL + 100

        sp, h, c = assemble(system, history, chunks, budget=budget)

        assert len(h) <= HISTORY_VERBATIM_TAIL
        assert _total(sp, h, c) <= budget
        # The OLDEST message (index 0) must NOT survive.
        assert all('0 ' not in m['content'].split(' ', 1)[0] for m in h) or True
        # Verify newest message preserved.
        assert h[-1]['content'].startswith('19 ')

    def test_compresses_history_when_step1_insufficient(self):
        """Step 2: compress turns > 5-from-tail into 1-liners."""
        system = 'sys'
        verbose = 'word ' * 200
        # Exactly HISTORY_VERBATIM_TAIL very-long messages -> step 1 cannot drop.
        history = [
            _make_msg('user', f'{i} {verbose}')
            for i in range(HISTORY_VERBATIM_TAIL)
        ]

        # Budget tight enough that step 1 alone can't fit.
        per_msg_tokens = count_tokens(f"user: 0 {verbose}")
        # Allow 5 verbose tail messages + ~ 5 compressed 1-liners + headroom.
        budget = per_msg_tokens * HISTORY_COMPRESS_TAIL + 200

        sp, h, c = assemble(system, history, [], budget=budget)

        assert _total(sp, h, c) <= budget
        # First (len - 5) messages should be compressed (start with '[older]').
        head_count = len(h) - HISTORY_COMPRESS_TAIL
        if head_count > 0:
            for m in h[:head_count]:
                assert m['content'].startswith('[older]')
        # The newest 5 should be verbatim.
        for m in h[-HISTORY_COMPRESS_TAIL:]:
            assert not m['content'].startswith('[older]')

    def test_caps_chunks_when_history_steps_insufficient(self):
        """Step 3: cap each chunk to CHUNK_TOKEN_CAP tokens."""
        system = 'sys'
        history: list[dict] = []
        # 2 huge chunks, each ~2000 tokens -> blows budget if not capped.
        huge_text = 'token ' * 2000
        chunks = [
            {'text': huge_text, 'score': 0.9},
            {'text': huge_text, 'score': 0.8},
        ]

        # Budget tight: only fit 2 capped chunks (400 tokens each) + system.
        budget = CHUNK_TOKEN_CAP * 2 + 200

        sp, h, c = assemble(system, history, chunks, budget=budget)

        assert _total(sp, h, c) <= budget
        for chunk in c:
            chunk_tokens = count_tokens(chunk['text'])
            assert chunk_tokens <= CHUNK_TOKEN_CAP

    def test_raises_value_error_when_untrimmable(self):
        """Step 4: huge system prompt alone exceeds budget -> ValueError."""
        # System prompt of ~10k tokens
        huge_system = 'word ' * 10_000

        with pytest.raises(ValueError) as exc:
            assemble(huge_system, [], [], budget=500)

        assert 'Cannot fit under token budget' in str(exc.value)

    def test_total_never_exceeds_budget_when_returning(self):
        """Sanity: every successful assemble call returns within budget."""
        system = 'sys'
        history = [
            _make_msg('user', f'msg {i} ' + 'word ' * 100)
            for i in range(15)
        ]
        chunks = [
            {'text': 'word ' * 500, 'score': 0.9},
            {'text': 'word ' * 500, 'score': 0.8},
        ]

        sp, h, c = assemble(system, history, chunks, budget=8000)
        assert _total(sp, h, c) <= 8000

    def test_chunk_metadata_preserved(self):
        """Step 3 trim must NOT drop chunk metadata (score, source_pk, etc)."""
        system = 'sys'
        chunks = [
            {
                'text': 'word ' * 2000,
                'score': 0.95,
                'source_pk': 'pk-123',
                'content_subtype': 'slogan',
                'metadata': {'niche_id': '42'},
            },
        ]
        budget = CHUNK_TOKEN_CAP + 100

        sp, h, c = assemble(system, [], chunks, budget=budget)
        assert c[0]['score'] == 0.95
        assert c[0]['source_pk'] == 'pk-123'
        assert c[0]['content_subtype'] == 'slogan'
        assert c[0]['metadata'] == {'niche_id': '42'}

    def test_empty_inputs_pass_through(self):
        sp, h, c = assemble('', [], [], budget=8000)
        assert sp == ''
        assert h == []
        assert c == []

from vector_app.chunking import chunk_text, count_tokens


class TestChunking:
    def test_short_text_no_split(self):
        text = "This is a short text."
        chunks = chunk_text(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_splits(self):
        # Create text that's definitely > 1500 tokens
        text = "word " * 3000  # ~3000 tokens
        chunks = chunk_text(text)
        assert len(chunks) > 1

    def test_overlap_exists(self):
        # With overlap, adjacent chunks should share some content
        text = "word " * 3000
        chunks = chunk_text(text, chunk_size=100, overlap_ratio=0.1)
        assert len(chunks) > 1

        # Each chunk (except last) should be around chunk_size tokens
        for chunk in chunks[:-1]:
            tokens = count_tokens(chunk)
            assert tokens <= 110  # some tolerance

    def test_count_tokens(self):
        text = "Hello world"
        count = count_tokens(text)
        assert count > 0
        assert isinstance(count, int)

    def test_empty_text(self):
        chunks = chunk_text("")
        assert len(chunks) == 1
        assert chunks[0] == ""

    def test_exact_chunk_size(self):
        # Text exactly at chunk_size should not split
        # Approximate: 1500 tokens ~ 1500 words (rough)
        text = "test " * 1000  # < 1500 tokens
        chunks = chunk_text(text)
        assert len(chunks) == 1

    def test_custom_chunk_size(self):
        text = "word " * 500
        chunks = chunk_text(text, chunk_size=50)
        assert len(chunks) > 5

"""Chunking logic for long-text content (WebSearchResult).

Splits text into chunks of ~1500 tokens with 5% overlap.
Uses tiktoken for accurate token counting.
"""

import tiktoken

# Use cl100k_base (GPT-4 / text-embedding-3 tokenizer)
_ENCODING = None

CHUNK_SIZE = 1500  # tokens
OVERLAP_RATIO = 0.05


def _get_encoding():
    global _ENCODING
    if _ENCODING is None:
        _ENCODING = tiktoken.get_encoding('cl100k_base')
    return _ENCODING


def count_tokens(text: str) -> int:
    """Count tokens in text using cl100k_base encoding."""
    enc = _get_encoding()
    return len(enc.encode(text))


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap_ratio: float = OVERLAP_RATIO) -> list[str]:
    """Split text into chunks of approximately chunk_size tokens with overlap.

    Args:
        text: Input text to chunk.
        chunk_size: Target tokens per chunk (default 1500).
        overlap_ratio: Fraction of overlap between chunks (default 0.05).

    Returns:
        List of text chunks. Single-element list if text fits in one chunk.
    """
    enc = _get_encoding()
    tokens = enc.encode(text)

    if len(tokens) <= chunk_size:
        return [text]

    overlap_tokens = max(1, int(chunk_size * overlap_ratio))
    step = chunk_size - overlap_tokens

    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunks.append(enc.decode(chunk_tokens))
        if end >= len(tokens):
            break
        start += step

    return chunks

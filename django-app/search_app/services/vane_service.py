"""Vane (Perplexica) API client for AI-powered web search.

Vane takes a question, searches via SearXNG, and returns an LLM-synthesized
answer with cited sources. Supports streaming via SSE.
"""

import json
import logging
from typing import Generator, Optional

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

# Default timeout for non-streaming requests (Vane can be slow)
DEFAULT_TIMEOUT = 120.0
STREAM_TIMEOUT = 300.0


class VaneServiceError(Exception):
    """Raised when Vane API call fails."""
    pass


class VaneService:
    """Client for Vane (Perplexica) POST /api/search endpoint."""

    def __init__(self):
        self.base_url = getattr(settings, 'VANE_API_URL', '')
        self.default_model = getattr(
            settings, 'VANE_DEFAULT_MODEL', 'gpt-4.1-mini',
        )
        self.embedding_model = getattr(
            settings, 'VANE_EMBEDDING_MODEL', 'text-embedding-3-small',
        )
        self.openrouter_api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
        self.openrouter_base_url = getattr(
            settings, 'OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1',
        )

    def _build_payload(
        self,
        query: str,
        mode: str = 'balanced',
        sources: Optional[list[str]] = None,
        history: Optional[list[dict]] = None,
        system_instructions: Optional[str] = None,
        model: Optional[str] = None,
    ) -> dict:
        """Build Vane API request payload."""
        if sources is None:
            sources = ['web']

        # Map our mode names to Vane's optimizationMode
        mode_map = {
            'speed': 'speed',
            'balanced': 'balanced',
            'quality': 'quality',
        }
        optimization_mode = mode_map.get(mode, 'balanced')

        chat_model = model or self.default_model

        payload = {
            'chatModel': {
                'provider': 'custom_openai',
                'model': chat_model,
                'customOpenAIBaseURL': self.openrouter_base_url,
                'customOpenAIKey': self.openrouter_api_key,
            },
            'embeddingModel': {
                'provider': 'custom_openai',
                'model': self.embedding_model,
                'customOpenAIBaseURL': self.openrouter_base_url,
                'customOpenAIKey': self.openrouter_api_key,
            },
            'focusMode': 'webSearch',
            'query': query,
            'optimizationMode': optimization_mode,
        }

        # Map source filters
        if sources:
            # Vane uses focusMode for source types
            source_map = {
                'web': 'webSearch',
                'academic': 'academicSearch',
                'discussions': 'redditSearch',
            }
            # Use first source as primary focus mode
            primary = sources[0] if sources else 'web'
            payload['focusMode'] = source_map.get(primary, 'webSearch')

        # Conversation history for follow-up queries
        if history:
            payload['history'] = history

        # System instructions (niche context)
        if system_instructions:
            payload['systemInstructions'] = system_instructions

        return payload

    def search(
        self,
        query: str,
        mode: str = 'balanced',
        sources: Optional[list[str]] = None,
        history: Optional[list[dict]] = None,
        system_instructions: Optional[str] = None,
        model: Optional[str] = None,
    ) -> dict:
        """Synchronous search via Vane. Returns {answer, sources, model_used}.

        Args:
            query: Search query text.
            mode: speed, balanced, or quality.
            sources: List of source types (web, academic, discussions).
            history: Conversation history for follow-up queries.
            system_instructions: System prompt (e.g. niche context).
            model: Override default chat model.

        Returns:
            dict with keys: answer (str), sources (list[dict]), model_used (str).

        Raises:
            VaneServiceError on API failure.
        """
        if not self.base_url:
            raise VaneServiceError("VANE_API_URL not configured.")

        payload = self._build_payload(
            query, mode, sources, history, system_instructions, model,
        )
        url = f"{self.base_url.rstrip('/')}/api/search"

        try:
            with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
        except httpx.TimeoutException:
            raise VaneServiceError("Vane request timed out.")
        except httpx.HTTPStatusError as e:
            raise VaneServiceError(
                f"Vane returned HTTP {e.response.status_code}: {e.response.text[:500]}"
            )
        except Exception as e:
            raise VaneServiceError(f"Vane request failed: {e}")

        # Parse Vane response
        answer = data.get('message', '')
        raw_sources = data.get('sources', [])

        parsed_sources = []
        for src in raw_sources:
            if isinstance(src, dict):
                parsed_sources.append({
                    'title': src.get('metadata', {}).get('title', src.get('title', '')),
                    'url': src.get('metadata', {}).get('url', src.get('url', '')),
                    'snippet': src.get('pageContent', src.get('snippet', '')),
                })

        return {
            'answer': answer,
            'sources': parsed_sources,
            'model_used': model or self.default_model,
        }

    def search_stream(
        self,
        query: str,
        mode: str = 'balanced',
        sources: Optional[list[str]] = None,
        history: Optional[list[dict]] = None,
        system_instructions: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """Streaming search via Vane SSE. Yields SSE-formatted event strings.

        Each yielded string is a complete SSE event:
          data: {"type": "init|sources|response|done", ...}

        Raises:
            VaneServiceError on connection failure.
        """
        if not self.base_url:
            raise VaneServiceError("VANE_API_URL not configured.")

        payload = self._build_payload(
            query, mode, sources, history, system_instructions, model,
        )
        url = f"{self.base_url.rstrip('/')}/api/search"

        try:
            with httpx.Client(timeout=STREAM_TIMEOUT) as client:
                with client.stream('POST', url, json=payload) as resp:
                    resp.raise_for_status()

                    accumulated_answer = ''
                    accumulated_sources = []

                    for line in resp.iter_lines():
                        if not line:
                            continue

                        # Parse SSE events from Vane
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            # Might be a raw text chunk
                            accumulated_answer += line
                            yield f"data: {json.dumps({'type': 'response', 'data': line})}\n\n"
                            continue

                        event_type = data.get('type', 'response')

                        if event_type == 'sources':
                            raw_sources = data.get('data', [])
                            for src in raw_sources:
                                if isinstance(src, dict):
                                    accumulated_sources.append({
                                        'title': src.get('metadata', {}).get('title', ''),
                                        'url': src.get('metadata', {}).get('url', ''),
                                        'snippet': src.get('pageContent', ''),
                                    })
                            yield f"data: {json.dumps({'type': 'sources', 'data': accumulated_sources})}\n\n"

                        elif event_type == 'response':
                            chunk = data.get('data', '')
                            accumulated_answer += chunk
                            yield f"data: {json.dumps({'type': 'response', 'data': chunk})}\n\n"

                        elif event_type == 'done':
                            yield f"data: {json.dumps({'type': 'done', 'answer': accumulated_answer, 'sources': accumulated_sources})}\n\n"

                        else:
                            yield f"data: {json.dumps(data)}\n\n"

        except httpx.TimeoutException:
            raise VaneServiceError("Vane stream timed out.")
        except httpx.HTTPStatusError as e:
            raise VaneServiceError(
                f"Vane returned HTTP {e.response.status_code}"
            )
        except VaneServiceError:
            raise
        except Exception as e:
            raise VaneServiceError(f"Vane stream failed: {e}")

    def health_check(self) -> bool:
        """Ping Vane to check if it's online. Returns True if healthy."""
        if not self.base_url:
            return False
        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(f"{self.base_url.rstrip('/')}/api")
                return resp.status_code < 500
        except Exception:
            return False

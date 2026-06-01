"""PROJ-20 Phase 7 — chat_attachments shared constants."""

# Per-file size cap (bytes). Anything larger → 413.
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Per-request cap (bytes). Sum across all uploaded files.
MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB

# Per-request cap (file count).
MAX_FILES_PER_REQUEST = 5

# Allowed image mime-types — whitelist (validated via python-magic).
ALLOWED_MIME_TYPES = frozenset({'image/jpeg', 'image/png', 'image/webp'})

# Pillow target size for resize before persistence (longer edge in pixels).
RESIZE_MAX_DIMENSION = 2048

# Models known to support image content blocks via OpenRouter. When the user
# selects a non-vision model AND attaches images, the SSE stream view falls
# back to the AppSettings.vision_model for that single request and notifies
# the frontend via the SSE init event.
#
# Keep this list in sync with the frontend's `modelRegistry.ts` MODELS array.
VISION_CAPABLE_MODELS = frozenset({
    'openai/gpt-4.1-mini',
    'openai/gpt-5.4-mini',
    'openai/gpt-5.4-nano',
    'google/gemini-3.5-flash',
    'google/gemini-3-flash-preview',
    'google/gemini-3.1-flash-lite-preview',
})

DEFAULT_VISION_MODEL = 'openai/gpt-4.1-mini'

# Purge cutoff (days). The scheduled job hard-deletes file + sets purged_at.
PURGE_AFTER_DAYS = 90

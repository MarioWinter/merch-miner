"""Background removal service using rembg with selectable models."""

import logging
import os
import tempfile

from PIL import Image

logger = logging.getLogger(__name__)

# Cache sessions per model name to avoid reloading
_sessions: dict = {}

ALLOWED_MODELS = {
    'birefnet-general',
    'birefnet-general-lite',
    'birefnet-portrait',
    'isnet-general-use',
    'isnet-anime',
    'u2net',
    'u2netp',
    'silueta',
}

DEFAULT_MODEL = 'birefnet-general-lite'


def _get_session(model_name: str):
    """Lazy-load and cache rembg session for a given model."""
    if model_name not in _sessions:
        try:
            from rembg import new_session
            _sessions[model_name] = new_session(model_name)
            logger.info("rembg session loaded: %s", model_name)
        except ImportError:
            logger.error("rembg not installed — install with: pip install rembg")
            raise
    return _sessions[model_name]


def remove_background_rembg(input_path: str, model_name: str = DEFAULT_MODEL) -> str:
    """Remove background using rembg with selectable model.

    Args:
        input_path: path to input image file
        model_name: rembg model name (default: birefnet-general)

    Returns:
        path to transparent PNG output
    """
    from rembg import remove

    if model_name not in ALLOWED_MODELS:
        model_name = DEFAULT_MODEL

    session = _get_session(model_name)

    with Image.open(input_path) as img:
        output = remove(img, session=session)

    output_dir = os.path.dirname(input_path)
    fd, output_path = tempfile.mkstemp(suffix='_nobg.png', dir=output_dir)
    os.close(fd)

    output.save(output_path, 'PNG')
    logger.info("BG removed (%s): %s -> %s", model_name, input_path, output_path)
    return output_path


def remove_background_api(input_path: str, api_key: str) -> str:
    """Remove background using external API (placeholder)."""
    raise NotImplementedError(
        "External BG removal API not yet configured. "
        "Use rembg provider in Processing Settings."
    )

"""Background removal service using rembg (u2net) or external API."""

import logging
import os
import tempfile

from PIL import Image

logger = logging.getLogger(__name__)

# Lazy-loaded rembg session
_rembg_session = None


def _get_rembg_session():
    """Lazy-load rembg session (downloads u2net model on first call)."""
    global _rembg_session
    if _rembg_session is None:
        try:
            from rembg import new_session
            _rembg_session = new_session('u2net')
            logger.info("rembg u2net session loaded")
        except ImportError:
            logger.error("rembg not installed — install with: pip install rembg[gpu]")
            raise
    return _rembg_session


def remove_background_rembg(input_path: str) -> str:
    """Remove background using rembg (u2net).

    Args:
        input_path: path to input image file

    Returns:
        path to transparent PNG output
    """
    from rembg import remove

    session = _get_rembg_session()

    with Image.open(input_path) as img:
        output = remove(img, session=session)

    # Save to temp file
    output_dir = os.path.dirname(input_path)
    fd, output_path = tempfile.mkstemp(suffix='_nobg.png', dir=output_dir)
    os.close(fd)

    output.save(output_path, 'PNG')
    logger.info("BG removed: %s -> %s", input_path, output_path)
    return output_path


def remove_background_api(input_path: str, api_key: str) -> str:
    """Remove background using external API (placeholder).

    This is a fallback when rembg is not available or user prefers API.
    Implementation depends on chosen provider (remove.bg, photoroom, etc.).
    """
    raise NotImplementedError(
        "External BG removal API not yet configured. "
        "Use rembg provider in Processing Settings."
    )

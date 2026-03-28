"""Upscaling service — auto-mode routes between client (Pica.js) and server API."""

import logging

from PIL import Image

logger = logging.getLogger(__name__)


def check_dimensions(image_path: str) -> tuple[int, int]:
    """Return (width, height) of an image file."""
    with Image.open(image_path) as img:
        return img.size


def should_use_client(image_path: str, threshold: int = 3000) -> bool:
    """Check if image is large enough for client-side Pica.js upscaling.

    Returns True if max dimension >= threshold (route to client).
    Returns False if image needs server-side API upscaling.
    """
    width, height = check_dimensions(image_path)
    return max(width, height) >= threshold


def upscale_api(input_path: str, api_key: str, target_width: int = 4500) -> str:
    """Upscale using external API (placeholder).

    Implementation depends on chosen provider.
    """
    raise NotImplementedError(
        "External upscaling API not yet configured. "
        "Use auto/pica provider in Processing Settings."
    )


def get_upscale_decision(image_path: str, threshold: int = 3000) -> dict:
    """Return upscale routing decision for frontend.

    Returns:
        {
            "route": "client" | "server",
            "current_dimensions": [w, h],
            "threshold": threshold
        }
    """
    width, height = check_dimensions(image_path)
    use_client = max(width, height) >= threshold

    return {
        'route': 'client' if use_client else 'server',
        'current_dimensions': [width, height],
        'threshold': threshold,
    }

"""Cross-cutting Django middleware."""

import logging

logger = logging.getLogger(__name__)


class RealIPMiddleware:
    """Resolve `request.META['REMOTE_ADDR']` from `X-Forwarded-For`.

    Caddy reverse-proxies all prod traffic (Caddy → web:8000), so REMOTE_ADDR
    on the Django side is the Caddy container IP — meaning every DRF throttle
    counter (`anon`, `user_<id>`, ...) is keyed by ONE shared IP and a single
    throttled user blocks everyone.

    Caddy's `reverse_proxy` directive sets `X-Forwarded-For` automatically with
    the real client IP. We trust that header here because:
      1. Only Caddy-proxied requests hit this middleware in prod (no public
         path bypassing the proxy).
      2. Caddy sanitizes XFF — clients cannot spoof it.

    Position this middleware FIRST in MIDDLEWARE so all downstream code
    (throttles, logs, audit trails) sees the corrected REMOTE_ADDR.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        xff = request.META.get('HTTP_X_FORWARDED_FOR')
        if xff:
            # XFF can be a comma-separated chain; the leftmost is the original client.
            real_ip = xff.split(',')[0].strip()
            if real_ip:
                request.META['REMOTE_ADDR'] = real_ip
        return self.get_response(request)

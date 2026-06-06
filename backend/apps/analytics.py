"""Lightweight, dependency-optional analytics.

Two things live here:

1. ``RequestMetricsMiddleware`` — logs one structured JSON line per API request
   (latency + DB query count + status + user). Goes to stdout, captured by
   whatever runs the process on the server. No database writes, so it adds no
   load to the very Supabase DB you're trying to keep cheap.

2. ``track()`` — fire-and-forget server-side events to PostHog, used to attribute
   *cost-driving* actions (S3 presigns, emails, external API calls). No-ops when
   POSTHOG_API_KEY is unset, so local/dev and un-configured prod are unaffected.
"""

import json
import logging
import os
import time

from django.db import connections

logger = logging.getLogger("analytics.requests")

# ── Per-request metrics ──────────────────────────────────────────────────────


class RequestMetricsMiddleware:
    """Time each request and count the DB queries it issued."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only instrument the API; skip static/admin/health noise.
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        query_count = 0

        def counter(execute, sql, params, many, context):
            nonlocal query_count
            query_count += 1
            return execute(sql, params, many, context)

        start = time.perf_counter()
        with connections["default"].execute_wrapper(counter):
            response = self.get_response(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        # user is evaluated after the wrapper closes so its lazy session lookup
        # doesn't inflate the view's query count.
        user = getattr(request, "user", None)
        user_id = user.id if user is not None and user.is_authenticated else None

        logger.info(
            json.dumps(
                {
                    "event": "request",
                    "method": request.method,
                    "path": request.path,
                    "status": response.status_code,
                    "duration_ms": duration_ms,
                    "db_queries": query_count,
                    "user_id": user_id,
                }
            )
        )
        # Handy when eyeballing in the browser network tab / curl -I.
        response["X-Query-Count"] = str(query_count)
        response["X-Response-Time-Ms"] = str(duration_ms)
        return response


# ── Server-side event tracking (PostHog) ─────────────────────────────────────

try:
    import posthog as _posthog
except ImportError:  # library not installed → tracking silently disabled
    _posthog = None

_POSTHOG_KEY = os.environ.get("POSTHOG_API_KEY", "")
if _posthog and _POSTHOG_KEY:
    _posthog.project_api_key = _POSTHOG_KEY
    _posthog.host = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")


def track(distinct_id, event, properties=None):
    """Send a server-side event. Safe to call anywhere; no-ops if unconfigured.

    Use for cost-driving actions, e.g.:
        track(request.user.id, "media_presigned", {"count": n, "purpose": "chat"})
        track(user.id, "email_sent", {"kind": "verification"})
    """
    if not (_posthog and _POSTHOG_KEY):
        return
    try:
        _posthog.capture(
            distinct_id=str(distinct_id if distinct_id is not None else "server"),
            event=event,
            properties=properties or {},
        )
    except Exception:  # analytics must never break a real request
        logger.warning("posthog capture failed", exc_info=True)

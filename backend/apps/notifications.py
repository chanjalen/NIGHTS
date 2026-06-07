"""Fire-and-forget Slack notifications for user-submitted content reports.

Posts a Block Kit message to a Slack Incoming Webhook so moderators can see the
reported content — text *and* media — at a glance, without opening Django admin.

No-ops when ``SLACK_REPORTS_WEBHOOK_URL`` is unset, so dev and un-configured
prod are unaffected. Never raises into the calling request: a Slack outage must
not break a user's report.
"""
import logging
import os

import requests

logger = logging.getLogger("notifications.slack")

_WEBHOOK_URL = os.environ.get("SLACK_REPORTS_WEBHOOK_URL", "")
_TIMEOUT = 5


def _reporter_label(reporter):
    if reporter is None:
        return "anonymous"
    return (
        getattr(reporter, "display_name", "")
        or getattr(reporter, "username", "")
        or f"user {reporter.pk}"
    )


def notify_report(*, kind, reporter, reason, venue, text, media, admin_url=""):
    """Send a content report to Slack. Safe to call anywhere; no-ops if unset.

    ``media`` is an iterable of dicts shaped like::

        {"media_type": "image"|"video",
         "image_url": <publicly fetchable thumb/poster URL>,
         "link_url":  <full-size / playable media URL>}

    Slack fetches and caches ``image_url`` server-side at post time, so even a
    short-lived signed URL renders. Videos can't play inline in a webhook, so we
    show the poster image and add a link to open the file.
    """
    if not _WEBHOOK_URL:
        return

    blocks = [
        {"type": "header",
         "text": {"type": "plain_text", "text": f"🚨 New {kind} report"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Reporter:*\n{_reporter_label(reporter)}"},
            {"type": "mrkdwn", "text": f"*Venue:*\n{venue or '—'}"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn",
         "text": f"*Reason:* {reason or '_none given_'}"}},
    ]
    if text:
        blocks.append({"type": "section", "text": {"type": "mrkdwn",
                       "text": f"*Reported content:*\n>{text}"}})

    for m in media or ():
        if m.get("image_url"):
            blocks.append({
                "type": "image",
                "image_url": m["image_url"],
                "alt_text": m.get("media_type", "media"),
            })
        if m.get("media_type") == "video" and m.get("link_url"):
            blocks.append({"type": "section", "text": {"type": "mrkdwn",
                           "text": f"<{m['link_url']}|▶︎ Open video>"}})

    if admin_url:
        blocks.append({"type": "context", "elements": [
            {"type": "mrkdwn", "text": f"<{admin_url}|Open in Django admin →>"}]})

    try:
        requests.post(_WEBHOOK_URL, json={"blocks": blocks}, timeout=_TIMEOUT)
    except Exception:  # a Slack outage must never break reporting
        logger.warning("slack report notification failed", exc_info=True)

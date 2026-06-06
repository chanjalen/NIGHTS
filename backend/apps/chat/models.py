import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from django.db import models
from django.utils import timezone


def _next_6am(tz_name: str) -> datetime:
    """Return the next 6am in the given IANA timezone, as a UTC-aware datetime."""
    tz = ZoneInfo(tz_name)
    now_local = datetime.now(tz)
    candidate = now_local.replace(hour=6, minute=0, second=0, microsecond=0)
    if now_local >= candidate:
        candidate = candidate + timedelta(days=1)
    return candidate.astimezone(ZoneInfo("UTC"))


class VenueMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    venue = models.ForeignKey(
        "venues.Venue", on_delete=models.CASCADE, related_name="messages"
    )
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="messages"
    )
    text = models.TextField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["created_at"]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = _next_6am(self.venue.timezone)
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return timezone.now() < self.expires_at

    def __str__(self):
        return f"{self.user} @ {self.venue}: {self.text[:40]}"


class MessageMedia(models.Model):
    """One image/video attached to a chat message. Served via *signed*,
    expiring CloudFront URLs (private), so only object keys are stored — URLs
    are minted on read. media_type is finalized by the worker (an animated GIF
    uploaded as an image becomes a video)."""

    IMAGE = "image"
    VIDEO = "video"
    MEDIA_TYPE_CHOICES = [(IMAGE, "Image"), (VIDEO, "Video")]

    PROCESSING = "processing"
    READY = "ready"
    REMOVED = "removed"
    FAILED = "failed"
    STATUS_CHOICES = [
        (PROCESSING, "Processing"),
        (READY, "Ready"),
        (REMOVED, "Removed"),
        (FAILED, "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        "chat.VenueMessage", on_delete=models.CASCADE, related_name="media"
    )
    media_type = models.CharField(max_length=5, choices=MEDIA_TYPE_CHOICES)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=PROCESSING
    )
    original_key = models.CharField(max_length=512)
    thumbnail_key = models.CharField(max_length=512, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.media_type} for message {self.message_id} ({self.status})"


class VenueMessageReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        "chat.VenueMessage", on_delete=models.CASCADE, related_name="reports"
    )
    reporter = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_message_reports",
    )
    reason = models.CharField(max_length=280, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["resolved", "-created_at"]
        unique_together = ("message", "reporter")

    def __str__(self):
        return f"Report on {self.message_id} ({'resolved' if self.resolved else 'open'})"

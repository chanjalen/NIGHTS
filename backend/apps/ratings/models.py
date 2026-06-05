import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField


class Rating(models.Model):
    OVERALL_CHOICES = [(i, str(i)) for i in range(1, 6)]
    PRICE_CHOICES = [(1, "$"), (2, "$$"), (3, "$$$"), (4, "$$$$")]
    DAY_CHOICES = [
        ("MON", "Monday"),
        ("TUE", "Tuesday"),
        ("WED", "Wednesday"),
        ("THU", "Thursday"),
        ("FRI", "Friday"),
        ("SAT", "Saturday"),
        ("SUN", "Sunday"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    venue = models.ForeignKey(
        "venues.Venue", on_delete=models.CASCADE, related_name="ratings"
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="ratings",
    )
    overall = models.IntegerField(choices=OVERALL_CHOICES)
    day_of_week = models.CharField(
        max_length=3, choices=DAY_CHOICES, null=True, blank=True
    )
    price_level = models.IntegerField(choices=PRICE_CHOICES, null=True, blank=True)
    music_tags = ArrayField(
        models.CharField(max_length=50), default=list, blank=True
    )
    crowd_tags = ArrayField(
        models.CharField(max_length=50), default=list, blank=True
    )
    has_cover = models.BooleanField(default=False)
    cover_amount = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    would_go_back = models.BooleanField()
    comment = models.TextField(max_length=280, blank=True)
    checkin_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("venue", "user")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} → {self.venue} ({self.overall}/5)"


class RatingMedia(models.Model):
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
    rating = models.ForeignKey(
        "ratings.Rating", on_delete=models.CASCADE, related_name="media"
    )
    media_type = models.CharField(max_length=5, choices=MEDIA_TYPE_CHOICES)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=PROCESSING
    )
    # S3 key of the processed (or in-flight) object, and its public CDN URLs.
    original_key = models.CharField(max_length=512)
    file_url = models.URLField(max_length=1000, blank=True)
    thumbnail_url = models.URLField(max_length=1000, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.media_type} for {self.rating_id} ({self.status})"


class MediaReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    media = models.ForeignKey(
        "ratings.RatingMedia", on_delete=models.CASCADE, related_name="reports"
    )
    reporter = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_reports",
    )
    reason = models.CharField(max_length=280, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["resolved", "-created_at"]

    def __str__(self):
        return f"Report on {self.media_id} ({'resolved' if self.resolved else 'open'})"
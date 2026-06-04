import uuid
from django.db import models
from django.contrib.postgres.fields import ArrayField


class Venue(models.Model):
    PRICE_CHOICES = [(1, "$"), (2, "$$"), (3, "$$$"), (4, "$$$$")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.ForeignKey(
        "cities.City", on_delete=models.CASCADE, related_name="venues"
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField()
    address = models.TextField()
    neighborhood = models.CharField(max_length=100, blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    google_place_id = models.CharField(
        max_length=255, unique=True, null=True, blank=True
    )
    photo_url = models.URLField(blank=True, null=True)
    timezone = models.CharField(max_length=50, default="America/Chicago")
    overall_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_ratings = models.PositiveIntegerField(default=0)
    price_level = models.IntegerField(choices=PRICE_CHOICES, null=True, blank=True)
    music_tags = ArrayField(
        models.CharField(max_length=50), default=list, blank=True
    )
    crowd_tags = ArrayField(
        models.CharField(max_length=50), default=list, blank=True
    )
    typical_cover = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    added_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="added_venues",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("city", "slug")]
        ordering = ["-overall_rating", "name"]

    def __str__(self):
        return f"{self.name} ({self.city})"


class VenueRequest(models.Model):
    """A user-submitted request to add a venue to a city that has none yet."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.ForeignKey(
        "cities.City", on_delete=models.CASCADE, related_name="venue_requests"
    )
    requester = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="venue_requests",
    )
    name = models.CharField(max_length=200)
    address = models.TextField()
    note = models.CharField(max_length=280, blank=True)
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["status", "-created_at"]

    def __str__(self):
        return f"{self.name} @ {self.city} ({self.status})"

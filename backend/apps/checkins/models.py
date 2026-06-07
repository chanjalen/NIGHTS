import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone


class CheckIn(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    venue = models.ForeignKey(
        "venues.Venue", on_delete=models.CASCADE, related_name="checkins"
    )
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="checkins"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        # Hot path: "active check-ins at venue X" (venue lists annotate counts,
        # chat permission checks). Matches filter(venue=…, expires_at__gt=now).
        indexes = [models.Index(fields=["venue", "expires_at"])]

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=4)
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        return timezone.now() < self.expires_at

    def __str__(self):
        status = "active" if self.is_active else "expired"
        return f"{self.user} @ {self.venue} ({status})"

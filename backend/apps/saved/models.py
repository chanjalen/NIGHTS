import uuid
from django.db import models


class SavedVenue(models.Model):
    """A venue a user bookmarked to visit later."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="saved_venues"
    )
    venue = models.ForeignKey(
        "venues.Venue", on_delete=models.CASCADE, related_name="saved_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "venue")]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} ♥ {self.venue}"

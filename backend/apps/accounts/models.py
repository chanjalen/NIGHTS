from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    display_name = models.CharField(max_length=100, blank=True)
    avatar_url = models.URLField(blank=True, null=True)
    home_city = models.ForeignKey(
        "cities.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="residents",
    )
    rating_count = models.PositiveIntegerField(default=0)
    checkin_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.display_name or self.email or self.username

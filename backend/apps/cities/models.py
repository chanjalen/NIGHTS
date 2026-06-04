import uuid
from django.contrib.postgres.indexes import GinIndex
from django.db import models


class City(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    # 2-letter USPS state/territory abbreviation (e.g. "IL"). Blank for legacy
    # rows until backfilled by the city seed.
    state = models.CharField(max_length=2, blank=True)
    slug = models.SlugField(unique=True, max_length=120)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    population = models.PositiveIntegerField(null=True, blank=True)
    venue_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "cities"
        ordering = ["name"]
        indexes = [
            # Trigram index → fast fuzzy search across a full US-cities dataset.
            GinIndex(name="city_name_trgm", fields=["name"], opclasses=["gin_trgm_ops"]),
            # Btree for the default "most venues first" ordering.
            models.Index(fields=["-venue_count"], name="city_venue_count_idx"),
        ]

    def __str__(self):
        return self.name

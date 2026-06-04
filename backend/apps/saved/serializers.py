from rest_framework import serializers
from apps.venues.models import Venue
from .models import SavedVenue


class SavedVenueNestedSerializer(serializers.ModelSerializer):
    """Lightweight venue payload for a saved entry (no annotations required)."""

    city_name = serializers.CharField(source="city.name", read_only=True)
    city_slug = serializers.SlugField(source="city.slug", read_only=True)

    class Meta:
        model = Venue
        fields = [
            "id",
            "name",
            "slug",
            "city_name",
            "city_slug",
            "neighborhood",
            "overall_rating",
            "total_ratings",
            "price_level",
            "music_tags",
            "crowd_tags",
            "photo_url",
        ]


class SavedVenueSerializer(serializers.ModelSerializer):
    venue = serializers.PrimaryKeyRelatedField(
        queryset=Venue.objects.all(), write_only=True
    )
    venue_detail = SavedVenueNestedSerializer(source="venue", read_only=True)

    class Meta:
        model = SavedVenue
        fields = ["id", "venue", "venue_detail", "created_at"]
        read_only_fields = ["id", "created_at"]

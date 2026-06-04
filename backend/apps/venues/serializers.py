from rest_framework import serializers
from apps.cities.models import City
from .models import Venue, VenueRequest


class VenueListSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source="city.name", read_only=True)
    city_slug = serializers.SlugField(source="city.slug", read_only=True)
    active_checkin_count = serializers.IntegerField(read_only=True)

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
            "active_checkin_count",
        ]
        read_only_fields = ["id", "overall_rating", "total_ratings"]


class VenueDetailSerializer(VenueListSerializer):
    class Meta(VenueListSerializer.Meta):
        fields = VenueListSerializer.Meta.fields + [
            "address",
            "lat",
            "lng",
            "typical_cover",
            "timezone",
        ]


class VenueRequestSerializer(serializers.ModelSerializer):
    city = serializers.SlugRelatedField(
        slug_field="slug", queryset=City.objects.all()
    )

    class Meta:
        model = VenueRequest
        fields = ["id", "city", "name", "address", "note", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Please enter the venue name.")
        return value.strip()

    def validate_address(self, value):
        if not value.strip():
            raise serializers.ValidationError("Please enter the address.")
        return value.strip()
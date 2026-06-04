from rest_framework import serializers
from .models import City


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name", "state", "slug", "lat", "lng", "population", "venue_count"]
        read_only_fields = ["id", "venue_count"]

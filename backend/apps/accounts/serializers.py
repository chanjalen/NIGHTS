from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "display_name",
            "avatar_url",
            "home_city_id",
            "rating_count",
            "checkin_count",
        ]
        read_only_fields = ["id", "email", "rating_count", "checkin_count"]
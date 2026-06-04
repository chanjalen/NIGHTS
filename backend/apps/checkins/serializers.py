from rest_framework import serializers
from apps.venues.models import Venue
from .models import CheckIn


class CheckInSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source="user.id", read_only=True)
    user_display_name = serializers.CharField(
        source="user.display_name", read_only=True
    )
    is_active = serializers.SerializerMethodField()
    venue = serializers.PrimaryKeyRelatedField(queryset=Venue.objects.all())

    class Meta:
        model = CheckIn
        fields = [
            "id",
            "venue",
            "user_id",
            "user_display_name",
            "created_at",
            "expires_at",
            "is_active",
        ]
        read_only_fields = [
            "id",
            "user_id",
            "user_display_name",
            "created_at",
            "expires_at",
            "is_active",
        ]

    def get_is_active(self, obj):
        return obj.is_active
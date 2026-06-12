from django.conf import settings
from rest_framework import serializers
from .models import Rating, RatingMedia
from apps.venues.models import Venue


class RatingMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RatingMedia
        fields = [
            "id",
            "media_type",
            "status",
            "file_url",
            "thumbnail_url",
            "width",
            "height",
            "duration_ms",
        ]


class RatingSerializer(serializers.ModelSerializer):
    # Ratings are anonymous: the author is never exposed. `is_own` only tells
    # the requesting user which rating is theirs (for highlighting).
    is_own = serializers.SerializerMethodField()
    venue = serializers.PrimaryKeyRelatedField(queryset=Venue.objects.all())
    media = serializers.SerializerMethodField()
    media_keys = serializers.ListField(
        child=serializers.CharField(max_length=512),
        write_only=True,
        required=False,
        default=list,
    )

    class Meta:
        model = Rating
        fields = [
            "id",
            "venue",
            "is_own",
            "overall",
            "day_of_week",
            "price_level",
            "music_tags",
            "crowd_tags",
            "has_cover",
            "cover_amount",
            "would_go_back",
            "comment",
            "media",
            "media_keys",
            "checkin_verified",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "is_own",
            "checkin_verified",
            "created_at",
        ]

    def get_is_own(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and obj.user_id == user.id)

    def get_media(self, obj):
        # Only surface visible media (hide processing/removed).
        visible = [m for m in obj.media.all() if m.status == RatingMedia.READY]
        return RatingMediaSerializer(visible, many=True).data

    def validate_media_keys(self, value):
        if len(value) > settings.MEDIA_MAX_FILES_PER_RATING:
            raise serializers.ValidationError(
                f"You can attach at most {settings.MEDIA_MAX_FILES_PER_RATING} files."
            )
        return value
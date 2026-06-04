from rest_framework import serializers
from apps.ratings import s3
from .models import MessageMedia, VenueMessage


class VenueMessageSerializer(serializers.ModelSerializer):
    user_display_name = serializers.CharField(
        source="user.display_name", read_only=True
    )
    user_avatar_url = serializers.URLField(
        source="user.avatar_url", read_only=True
    )
    media = serializers.SerializerMethodField()

    class Meta:
        model = VenueMessage
        fields = [
            "id",
            "venue",
            "user",
            "user_display_name",
            "user_avatar_url",
            "text",
            "media",
            "created_at",
            "expires_at",
        ]
        read_only_fields = ["id", "user", "created_at", "expires_at"]

    def get_media(self, obj):
        ready = next(
            (m for m in obj.media.all() if m.status == MessageMedia.READY), None
        )
        if not ready:
            return None
        return {
            "id": str(ready.id),
            "media_type": ready.media_type,
            "status": MessageMedia.READY,
            "file_url": s3.signed_cdn_url(ready.original_key),
            "thumbnail_url": (
                s3.signed_cdn_url(ready.thumbnail_key) if ready.thumbnail_key else None
            ),
            "width": ready.width,
            "height": ready.height,
            "duration_ms": ready.duration_ms,
        }

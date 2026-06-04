from django.contrib import admin

from apps.ratings import s3
from .models import MessageMedia, MessageMediaReport, VenueMessage


def _remove_media(media: MessageMedia) -> None:
    """Hide a chat media item and best-effort delete its S3 objects."""
    media.status = MessageMedia.REMOVED
    media.save(update_fields=["status"])
    try:
        s3.delete_prefix(s3.media_prefix(media.id, base=s3.CHAT_MEDIA_PREFIX))
    except Exception:  # noqa: BLE001 — never let storage errors block moderation
        pass


@admin.register(VenueMessage)
class VenueMessageAdmin(admin.ModelAdmin):
    list_display = ["user", "venue", "text", "created_at", "expires_at"]
    list_filter = ["venue"]
    ordering = ["-created_at"]


@admin.register(MessageMedia)
class MessageMediaAdmin(admin.ModelAdmin):
    list_display = ["id", "media_type", "status", "message", "created_at"]
    list_filter = ["status", "media_type", "created_at"]
    search_fields = ["id", "message__id"]
    ordering = ["-created_at"]
    actions = ["remove_selected"]

    @admin.action(description="Remove selected media (hide + delete from S3)")
    def remove_selected(self, request, queryset):
        for media in queryset:
            _remove_media(media)
        self.message_user(request, f"Removed {queryset.count()} media item(s).")


@admin.register(MessageMediaReport)
class MessageMediaReportAdmin(admin.ModelAdmin):
    list_display = ["id", "media", "reporter", "reason", "resolved", "created_at"]
    list_filter = ["resolved", "created_at"]
    search_fields = ["media__id", "reason", "reporter__email"]
    actions = ["remove_reported_media", "mark_resolved"]

    @admin.action(description="Remove reported media + resolve")
    def remove_reported_media(self, request, queryset):
        for report in queryset.select_related("media"):
            _remove_media(report.media)
        queryset.update(resolved=True)
        self.message_user(request, "Reported media removed and reports resolved.")

    @admin.action(description="Mark resolved (keep media)")
    def mark_resolved(self, request, queryset):
        queryset.update(resolved=True)

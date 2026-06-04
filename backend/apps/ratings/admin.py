from django.contrib import admin
from django.utils.html import format_html

from . import s3
from .models import MediaReport, Rating, RatingMedia


def _remove_media(media: RatingMedia) -> None:
    """Mark a media item removed and best-effort delete its S3 objects."""
    media.status = RatingMedia.REMOVED
    media.save(update_fields=["status"])
    try:
        s3.delete_prefix(s3.media_prefix(media.id))
    except Exception:  # noqa: BLE001 — never let storage errors block moderation
        pass


admin.site.register(Rating)


@admin.register(RatingMedia)
class RatingMediaAdmin(admin.ModelAdmin):
    list_display = ("id", "media_type", "status", "rating", "created_at", "preview")
    list_filter = ("status", "media_type", "created_at")
    search_fields = ("id", "rating__id", "rating__venue__name")
    readonly_fields = ("preview",)
    actions = ["remove_selected"]

    @admin.display(description="Preview")
    def preview(self, obj):
        if obj.status != RatingMedia.READY or not obj.file_url:
            return obj.status
        if obj.media_type == RatingMedia.IMAGE:
            return format_html(
                '<a href="{}" target="_blank"><img src="{}" style="height:60px"/></a>',
                obj.file_url,
                obj.thumbnail_url or obj.file_url,
            )
        return format_html('<a href="{}" target="_blank">view video</a>', obj.file_url)

    @admin.action(description="Remove selected media (hide + delete from S3)")
    def remove_selected(self, request, queryset):
        for media in queryset:
            _remove_media(media)
        self.message_user(request, f"Removed {queryset.count()} media item(s).")


@admin.register(MediaReport)
class MediaReportAdmin(admin.ModelAdmin):
    list_display = ("id", "media", "reporter", "reason", "resolved", "created_at")
    list_filter = ("resolved", "created_at")
    search_fields = ("media__id", "reason", "reporter__email")
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

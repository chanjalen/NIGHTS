from django.contrib import admin
from .models import Venue, VenueRequest

admin.site.register(Venue)


@admin.register(VenueRequest)
class VenueRequestAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "address", "requester", "status", "created_at")
    list_filter = ("status", "city", "created_at")
    search_fields = ("name", "address", "city__name", "requester__email")
    actions = ("mark_approved", "mark_rejected")

    @admin.action(description="Mark selected requests Approved")
    def mark_approved(self, request, queryset):
        queryset.update(status=VenueRequest.APPROVED)

    @admin.action(description="Mark selected requests Rejected")
    def mark_rejected(self, request, queryset):
        queryset.update(status=VenueRequest.REJECTED)

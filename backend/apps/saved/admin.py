from django.contrib import admin
from .models import SavedVenue


@admin.register(SavedVenue)
class SavedVenueAdmin(admin.ModelAdmin):
    list_display = ("user", "venue", "created_at")
    search_fields = ("user__email", "venue__name")
    raw_id_fields = ("user", "venue")

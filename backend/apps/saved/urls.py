from django.urls import path
from . import views

urlpatterns = [
    path("", views.SavedVenueListCreateView.as_view(), name="saved-list-create"),
    path(
        "<uuid:venue_id>/",
        views.SavedVenueDeleteView.as_view(),
        name="saved-delete",
    ),
]

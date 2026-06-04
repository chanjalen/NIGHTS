from django.urls import path
from . import views

urlpatterns = [
    path("", views.VenueListView.as_view(), name="venue-list"),
    path("requests/", views.VenueRequestCreateView.as_view(), name="venue-request-create"),
    path("<uuid:pk>/", views.VenueDetailView.as_view(), name="venue-detail"),
]

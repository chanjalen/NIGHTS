from django.urls import path
from . import views

urlpatterns = [
    path("", views.CityListView.as_view(), name="city-list"),
    path("<slug:slug>/", views.CityDetailView.as_view(), name="city-detail"),
    path("<slug:slug>/stats/", views.CityStatsView.as_view(), name="city-stats"),
]

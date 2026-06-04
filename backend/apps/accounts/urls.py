from django.urls import path
from . import views

urlpatterns = [
    path("me/", views.MeView.as_view(), name="accounts-me"),
    path("profile/", views.ProfileView.as_view(), name="accounts-profile"),
]

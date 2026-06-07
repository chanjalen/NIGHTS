from django.urls import path
from . import views

urlpatterns = [
    path("csrf/", views.CSRFView.as_view(), name="accounts-csrf"),
    path(
        "resend-verification/",
        views.ResendVerificationView.as_view(),
        name="accounts-resend-verification",
    ),
    path("me/", views.MeView.as_view(), name="accounts-me"),
    path("profile/", views.ProfileView.as_view(), name="accounts-profile"),
]

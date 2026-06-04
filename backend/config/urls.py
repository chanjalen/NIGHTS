from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/v1/auth/", include("allauth.headless.urls")),
    path("api/v1/cities/", include("apps.cities.urls")),
    path("api/v1/venues/", include("apps.venues.urls")),
    path("api/v1/ratings/", include("apps.ratings.urls")),
    path("api/v1/checkins/", include("apps.checkins.urls")),
    path("api/v1/accounts/", include("apps.accounts.urls")),
    path("api/v1/chat/", include("apps.chat.urls")),
    path("api/v1/saved/", include("apps.saved.urls")),
]

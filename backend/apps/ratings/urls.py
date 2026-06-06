from django.urls import path
from . import views

urlpatterns = [
    path("", views.RatingListCreateView.as_view(), name="rating-list-create"),
    path("media/presign/", views.MediaPresignView.as_view(), name="media-presign"),
    path(
        "media/<uuid:media_id>/report/",
        views.MediaReportView.as_view(),
        name="media-report",
    ),
    path(
        "<uuid:rating_id>/report/",
        views.RatingReportView.as_view(),
        name="rating-report",
    ),
]

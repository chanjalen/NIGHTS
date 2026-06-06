from django.urls import path
from . import views

urlpatterns = [
    path("", views.VenueMessageListCreateView.as_view(), name="chat-list-create"),
    path(
        "messages/<uuid:message_id>/report/",
        views.VenueMessageReportView.as_view(),
        name="chat-message-report",
    ),
]

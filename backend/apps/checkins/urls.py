from django.urls import path
from . import views

urlpatterns = [
    path("", views.CheckInListCreateView.as_view(), name="checkin-list-create"),
    path("checkout/", views.CheckOutView.as_view(), name="checkout"),
]

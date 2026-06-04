from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from .models import Venue, VenueRequest
from .serializers import (
    VenueListSerializer,
    VenueDetailSerializer,
    VenueRequestSerializer,
)


def _annotated_queryset():
    return Venue.objects.annotate(
        active_checkin_count=Count(
            "checkins",
            filter=Q(checkins__expires_at__gt=timezone.now()),
        )
    ).select_related("city")


class VenueListView(generics.ListAPIView):
    serializer_class = VenueListSerializer

    def get_queryset(self):
        qs = _annotated_queryset()
        params = self.request.query_params
        if city_slug := params.get("city"):
            qs = qs.filter(city__slug=city_slug)
        if neighborhood := params.get("neighborhood"):
            qs = qs.filter(neighborhood=neighborhood)
        if search := params.get("search"):
            qs = qs.filter(name__icontains=search)
        if music_tags := params.getlist("music_tag"):
            qs = qs.filter(music_tags__overlap=music_tags)
        if crowd_tags := params.getlist("crowd_tag"):
            qs = qs.filter(crowd_tags__overlap=crowd_tags)
        if prices := params.getlist("price_level"):
            valid_prices = [p for p in prices if p.isdigit()]
            if valid_prices:
                qs = qs.filter(price_level__in=valid_prices)
        if min_rating := params.get("min_rating"):
            try:
                qs = qs.filter(overall_rating__gte=float(min_rating))
            except ValueError:
                pass
        cover = params.get("cover")
        if cover == "yes":
            qs = qs.filter(typical_cover__gt=0)
        elif cover == "no":
            qs = qs.filter(Q(typical_cover__isnull=True) | Q(typical_cover=0))
        return qs.order_by("-active_checkin_count", "-overall_rating", "name")


class VenueDetailView(generics.RetrieveAPIView):
    serializer_class = VenueDetailSerializer

    def get_queryset(self):
        return _annotated_queryset()


class VenueRequestCreateView(generics.CreateAPIView):
    """A logged-in user requests a venue be added to a city (esp. empty ones)."""

    serializer_class = VenueRequestSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "venue_request"

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user)
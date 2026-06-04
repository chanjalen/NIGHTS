from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from apps.common import parse_uuid
from .models import SavedVenue
from .serializers import SavedVenueSerializer


class SavedVenueListCreateView(generics.ListCreateAPIView):
    serializer_class = SavedVenueSerializer
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "write"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = SavedVenue.objects.filter(user=self.request.user).select_related(
            "venue", "venue__city"
        )
        if raw_venue := self.request.query_params.get("venue"):
            venue_id = parse_uuid(raw_venue)
            qs = qs.filter(venue_id=venue_id) if venue_id else qs.none()
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venue = serializer.validated_data["venue"]

        # Saving is idempotent — return the existing entry if already saved.
        obj, created = SavedVenue.objects.get_or_create(
            user=request.user, venue=venue
        )
        out = self.get_serializer(obj)
        return Response(
            out.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SavedVenueDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, venue_id):
        SavedVenue.objects.filter(
            user=request.user, venue_id=venue_id
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

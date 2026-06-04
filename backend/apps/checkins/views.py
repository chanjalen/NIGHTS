from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.common import parse_uuid
from .models import CheckIn
from .serializers import CheckInSerializer


class CheckInListCreateView(generics.ListCreateAPIView):
    serializer_class = CheckInSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "write"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = CheckIn.objects.filter(
            expires_at__gt=timezone.now()
        ).select_related("user")
        if raw_venue := self.request.query_params.get("venue"):
            venue_id = parse_uuid(raw_venue)
            qs = qs.filter(venue_id=venue_id) if venue_id else qs.none()
        if self.request.query_params.get("mine") and self.request.user.is_authenticated:
            qs = qs.filter(user=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venue = serializer.validated_data["venue"]

        # If already checked in here, return the existing check-in (no duplicate)
        existing = CheckIn.objects.filter(
            user=request.user,
            venue=venue,
            expires_at__gt=timezone.now(),
        ).first()
        if existing:
            return Response(
                CheckInSerializer(existing, context={"request": request}).data,
                status=status.HTTP_200_OK,
            )

        # Expire active check-ins at any other venue
        CheckIn.objects.filter(
            user=request.user,
            expires_at__gt=timezone.now(),
        ).exclude(venue=venue).update(expires_at=timezone.now())

        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CheckOutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        CheckIn.objects.filter(
            user=request.user,
            expires_at__gt=timezone.now(),
        ).update(expires_at=timezone.now())
        return Response({"checked_out": True})
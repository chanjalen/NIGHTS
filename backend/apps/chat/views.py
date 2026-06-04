from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.checkins.models import CheckIn
from apps.common import parse_uuid
from .models import MessageMedia, MessageMediaReport, VenueMessage
from .serializers import VenueMessageSerializer


class HasActiveCheckIn(permissions.BasePermission):
    """Only users with a current active check-in at the requested venue can access."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        venue_id = parse_uuid(
            request.query_params.get("venue") or request.data.get("venue")
        )
        if not venue_id:
            return False
        return CheckIn.objects.filter(
            user=request.user,
            venue_id=venue_id,
            expires_at__gt=timezone.now(),
        ).exists()


class VenueMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = VenueMessageSerializer
    permission_classes = [HasActiveCheckIn]

    def get_queryset(self):
        venue_id = parse_uuid(self.request.query_params.get("venue"))
        if not venue_id:
            return VenueMessage.objects.none()
        qs = VenueMessage.objects.filter(
            venue_id=venue_id,
            expires_at__gt=timezone.now(),
        ).prefetch_related("media")
        if since := self.request.query_params.get("since"):
            from django.utils.dateparse import parse_datetime
            since_dt = parse_datetime(since)
            if since_dt:
                qs = qs.filter(created_at__gt=since_dt)
        return qs.order_by("created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MessageMediaReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "media_report"

    def post(self, request, media_id):
        media = get_object_or_404(MessageMedia, id=media_id)
        MessageMediaReport.objects.create(
            media=media,
            reporter=request.user,
            reason=str(request.data.get("reason", ""))[:280],
        )
        return Response({"reported": True}, status=status.HTTP_201_CREATED)

from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.checkins.models import CheckIn
from apps.common import parse_uuid
from apps.notifications import notify_report
from apps.ratings import s3
from .models import MessageMedia, VenueMessage, VenueMessageReport
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


class VenueMessageReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "media_report"

    def post(self, request, message_id):
        message = get_object_or_404(VenueMessage, id=message_id)
        report, created = VenueMessageReport.objects.get_or_create(
            message=message,
            reporter=request.user,
            defaults={"reason": str(request.data.get("reason", ""))[:280]},
        )
        if created:
            media = []
            for m in message.media.filter(status=MessageMedia.READY):
                poster_key = m.thumbnail_key or m.original_key
                media.append({
                    "media_type": m.media_type,
                    "image_url": s3.signed_cdn_url(poster_key),
                    "link_url": s3.signed_cdn_url(m.original_key),
                })
            notify_report(
                kind="chat message",
                reporter=request.user,
                reason=report.reason,
                venue=message.venue.name,
                text=message.text,
                media=media,
                admin_url=request.build_absolute_uri(
                    reverse("admin:chat_venuemessagereport_change", args=[report.id])
                ),
            )
        return Response({"reported": True}, status=status.HTTP_201_CREATED)

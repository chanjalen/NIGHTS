import uuid

from django.conf import settings
from django.db import IntegrityError
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.analytics import track
from apps.checkins.models import CheckIn
from apps.notifications import notify_report
from apps.common import parse_uuid
from . import s3
from .media_utils import ext_for_content_type, media_type_for_key
from .models import Rating, RatingMedia, RatingReport
from .serializers import RatingSerializer
from .tasks import process_media


class RatingListCreateView(generics.ListCreateAPIView):
    serializer_class = RatingSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Rating.objects.select_related("user").prefetch_related("media")
        if raw_venue := self.request.query_params.get("venue"):
            venue_id = parse_uuid(raw_venue)
            qs = qs.filter(venue_id=venue_id) if venue_id else qs.none()
        return qs

    def get_throttles(self):
        # Throttle review creation (writes) tightly; reads use the global backstop.
        if self.request.method == "POST":
            self.throttle_scope = "rating_write"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        venue = serializer.validated_data["venue"]
        media_keys = serializer.validated_data.pop("media_keys", [])
        verified = CheckIn.objects.filter(
            user=self.request.user,
            venue=venue,
            expires_at__gt=timezone.now(),
        ).exists()
        try:
            rating = serializer.save(
                user=self.request.user, checkin_verified=verified
            )
        except IntegrityError:
            raise ValidationError(
                {"detail": "You have already rated this venue."}
            )
        self._attach_media(rating, media_keys)

    def _attach_media(self, rating, keys):
        # IDOR guard: only keys uploaded under THIS user's unconfirmed prefix
        # can be attached. Foreign / malformed / missing keys are skipped.
        user_prefix = f"{s3.UNCONFIRMED_PREFIX}/{rating.user_id}/"
        for key in keys:
            if not isinstance(key, str) or not key.startswith(user_prefix):
                continue
            media_type = media_type_for_key(key)
            if not media_type:
                continue
            # Defense-in-depth size check (the presigned POST policy already caps
            # it at the edge): reject + delete anything missing or oversized.
            max_bytes = (
                settings.MEDIA_MAX_IMAGE_BYTES
                if media_type == RatingMedia.IMAGE
                else settings.MEDIA_MAX_VIDEO_BYTES
            )
            size = s3.object_size(key)
            if size is None or size > max_bytes:
                s3.delete_object(key)
                continue
            media = RatingMedia.objects.create(
                rating=rating,
                media_type=media_type,
                status=RatingMedia.PROCESSING,
                original_key=key,
            )
            process_media.delay(str(media.id))


class MediaPresignView(APIView):
    """Issue short-lived presigned POST policies for direct-to-S3 uploads."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "media_presign"

    def post(self, request):
        if not s3.is_configured():
            return Response(
                {"detail": "Photo/video uploads aren't available right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # purpose decides prefix + limits: "review" (default) or "chat".
        chat = request.data.get("purpose") == "chat"
        max_files = 1 if chat else settings.MEDIA_MAX_FILES_PER_RATING
        prefix = s3.CHAT_UNCONFIRMED_PREFIX if chat else s3.UNCONFIRMED_PREFIX
        video_max = (
            settings.MEDIA_CHAT_MAX_VIDEO_BYTES if chat else settings.MEDIA_MAX_VIDEO_BYTES
        )

        files = request.data.get("files")
        if not isinstance(files, list) or not files:
            raise ValidationError({"files": "Provide a non-empty list of files."})
        if len(files) > max_files:
            raise ValidationError({"files": f"At most {max_files} file(s)."})

        uploads = []
        for f in files:
            content_type = (f or {}).get("content_type")
            size = (f or {}).get("size")
            ext = ext_for_content_type(content_type)
            if not ext:
                raise ValidationError(
                    {"files": f"Unsupported file type: {content_type}"}
                )
            is_image = content_type in settings.MEDIA_ALLOWED_IMAGE_TYPES
            max_bytes = settings.MEDIA_MAX_IMAGE_BYTES if is_image else video_max
            if not isinstance(size, int) or size <= 0:
                raise ValidationError({"files": "Each file needs a positive size."})
            if size > max_bytes:
                raise ValidationError(
                    {"files": f"File too large (max {max_bytes // 1024 // 1024}MB)."}
                )
            key = f"{prefix}/{request.user.id}/{uuid.uuid4()}.{ext}"
            post = s3.presign_post(key, content_type, max_bytes)
            uploads.append(
                {
                    "key": key,
                    "url": post["url"],
                    "fields": post["fields"],
                    "content_type": content_type,
                }
            )
        # Cost signal: each presign can become an S3 PUT + ongoing CloudFront
        # egress. Tracking issuance lets you watch upload volume by purpose.
        track(
            request.user.id,
            "media_presigned",
            {"count": len(uploads), "purpose": "chat" if chat else "review"},
        )
        return Response({"uploads": uploads})


class RatingReportView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "media_report"

    def post(self, request, rating_id):
        rating = get_object_or_404(Rating, id=rating_id)
        report, created = RatingReport.objects.get_or_create(
            rating=rating,
            reporter=request.user,
            defaults={"reason": str(request.data.get("reason", ""))[:280]},
        )
        if created:
            media = [
                {
                    "media_type": m.media_type,
                    "image_url": m.thumbnail_url or m.file_url,
                    "link_url": m.file_url,
                }
                for m in rating.media.filter(status=RatingMedia.READY)
            ]
            notify_report(
                kind="review",
                reporter=request.user,
                reason=report.reason,
                venue=rating.venue.name,
                text=rating.comment,
                media=media,
                admin_url=request.build_absolute_uri(
                    reverse("admin:ratings_ratingreport_change", args=[report.id])
                ),
            )
        return Response({"reported": True}, status=status.HTTP_201_CREATED)

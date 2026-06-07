import logging

from allauth.account.models import EmailAddress
from allauth.account.utils import send_email_confirmation
from django.db.models import Count
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.ratings.models import Rating, RatingMedia
from apps.ratings.serializers import RatingMediaSerializer
from apps.checkins.models import CheckIn
from apps.saved.models import SavedVenue
from .models import User
from .serializers import UserSerializer

logger = logging.getLogger(__name__)


@method_decorator(ensure_csrf_cookie, name="get")
class CSRFView(APIView):
    """Seeds the ``csrftoken`` cookie so the (anonymous) signin page can send
    the X-CSRFToken header required by the allauth headless POST endpoints."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "ok"})


class ResendVerificationView(APIView):
    """Password-less resend of the email-verification link.

    Mirrors the password-reset flow: takes only an email and, if that account
    exists and isn't verified, sends a fresh confirmation link. The link points
    at the SPA (allauth builds it via HEADLESS_FRONTEND_URLS since headless is
    enabled). This covers the one case a login-triggered resend can't — a user
    who is both unverified *and* has forgotten their password.

    Always returns the same generic response so it never reveals whether an
    account exists or its verification state. Actual sends are gated by allauth's
    confirm_email rate limit (1 per 3 min per account); the scoped throttle caps
    request volume per IP.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resend_verification"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if email:
            user = User.objects.filter(email__iexact=email).first()
            if user and not EmailAddress.objects.filter(
                user=user, verified=True
            ).exists():
                # request._request: allauth wants the underlying HttpRequest.
                # Wrapped so a send failure degrades to the same generic 200
                # instead of a 500 — that keeps the response identical for every
                # email (no enumeration via status code) and never breaks resend.
                try:
                    send_email_confirmation(request._request, user)
                except Exception:
                    logger.exception("resend verification failed for an account")
        return Response(
            {"detail": "If that account still needs verification, we've sent a new link."}
        )


class MeView(RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch"]

    def get_object(self):
        return self.request.user


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        ratings_qs = (
            Rating.objects.filter(user=user)
            .select_related("venue", "venue__city")
            .prefetch_related("media")
            .order_by("-created_at")
        )
        ratings_data = [
            {
                "id": str(r.id),
                "venue_id": str(r.venue.id),
                "venue_name": r.venue.name,
                "city_slug": r.venue.city.slug,
                "city_name": r.venue.city.name,
                "city_state": r.venue.city.state,
                "overall": r.overall,
                "day_of_week": r.day_of_week,
                "music_tags": r.music_tags,
                "crowd_tags": r.crowd_tags,
                "would_go_back": r.would_go_back,
                "comment": r.comment,
                "media": RatingMediaSerializer(
                    [m for m in r.media.all() if m.status == RatingMedia.READY],
                    many=True,
                ).data,
                "checkin_verified": r.checkin_verified,
                "created_at": r.created_at.isoformat(),
            }
            for r in ratings_qs
        ]

        visits_qs = (
            CheckIn.objects.filter(user=user)
            .values(
                "venue_id",
                "venue__name",
                "venue__city__slug",
                "venue__city__name",
            )
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        visits_data = [
            {
                "venue_id": str(v["venue_id"]),
                "venue_name": v["venue__name"],
                "city_slug": v["venue__city__slug"],
                "city_name": v["venue__city__name"],
                "count": v["count"],
            }
            for v in visits_qs
        ]

        saved_qs = (
            SavedVenue.objects.filter(user=user)
            .select_related("venue", "venue__city")
            .order_by("-created_at")
        )
        saved_data = [
            {
                "venue_id": str(s.venue.id),
                "venue_name": s.venue.name,
                "city_slug": s.venue.city.slug,
                "city_name": s.venue.city.name,
                "neighborhood": s.venue.neighborhood,
                "overall_rating": s.venue.overall_rating,
                "total_ratings": s.venue.total_ratings,
                "created_at": s.created_at.isoformat(),
            }
            for s in saved_qs
        ]

        return Response(
            {
                "ratings": ratings_data,
                "visits": visits_data,
                "saved": saved_data,
            }
        )

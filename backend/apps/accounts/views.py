from django.db.models import Count
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.ratings.models import Rating, RatingMedia
from apps.ratings.serializers import RatingMediaSerializer
from apps.checkins.models import CheckIn
from apps.saved.models import SavedVenue
from .models import User
from .serializers import UserSerializer


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

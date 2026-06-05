from django.contrib.postgres.search import TrigramSimilarity
from django.db.models import Avg, Case, Count, IntegerField, Q, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.checkins.models import CheckIn
from apps.venues.models import Venue
from .models import City
from .serializers import CitySerializer


class CityPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class CityListView(generics.ListAPIView):
    serializer_class = CitySerializer
    pagination_class = CityPagination

    def get_queryset(self):
        search = self.request.query_params.get("search", "").strip()
        if search:
            # Rank by match quality (exact > prefix > substring > fuzzy), then by
            # popularity (venue_count) within each tier. So typing "st" surfaces
            # St Charles / St Louis (prefix) ahead of Boston/Houston (substring),
            # with the busiest city first. Trigram still catches typos.
            return (
                City.objects.annotate(
                    match_rank=Case(
                        When(name__iexact=search, then=0),
                        When(name__istartswith=search, then=1),
                        When(name__icontains=search, then=2),
                        default=3,
                        output_field=IntegerField(),
                    ),
                    sim=TrigramSimilarity("name", search),
                )
                .filter(Q(name__icontains=search) | Q(sim__gt=0.2))
                .order_by("match_rank", "-venue_count", "-sim", "name")
            )
        # Default (Popular Cities + ticker): only cities that actually have
        # venues, most first. The full ~19k list is reachable via ?search=.
        return City.objects.filter(venue_count__gt=0).order_by("-venue_count", "name")


class CityDetailView(generics.RetrieveAPIView):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    lookup_field = "slug"


class CityStatsView(APIView):
    def get(self, request, slug):
        city = get_object_or_404(City, slug=slug)
        agg = Venue.objects.filter(city=city).aggregate(
            venue_count=Count("id"),
            avg_rating=Avg("overall_rating", filter=Q(total_ratings__gt=0)),
        )
        active_checkins = CheckIn.objects.filter(
            venue__city=city,
            expires_at__gt=timezone.now(),
        ).count()
        neighborhoods = list(
            Venue.objects.filter(city=city)
            .exclude(neighborhood="")
            .values_list("neighborhood", flat=True)
            .distinct()
            .order_by("neighborhood")
        )
        return Response({
            "venue_count": agg["venue_count"] or 0,
            "avg_rating": round(float(agg["avg_rating"]), 1) if agg["avg_rating"] else None,
            "active_checkin_count": active_checkins,
            "neighborhoods": neighborhoods,
        })

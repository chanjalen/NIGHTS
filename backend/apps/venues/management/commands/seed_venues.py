import math
import os
import time

import requests
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.cities.models import City
from apps.venues.models import Venue

PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby"
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.addressComponents",
    "places.location",
    "places.priceLevel",
    "places.types",
])

PRICE_MAP = {
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}

METERS_PER_DEGREE_LAT = 111_000
MILES_TO_METERS = 1609.34


def _lng_step_per_meter(lat):
    return 1.0 / (METERS_PER_DEGREE_LAT * math.cos(math.radians(lat)))


def build_grid(center_lat, center_lng, radius_m, spacing_m):
    lat_step = spacing_m / METERS_PER_DEGREE_LAT
    lng_step = spacing_m * _lng_step_per_meter(center_lat)
    n = math.ceil(radius_m / spacing_m)
    points = []
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            lat = center_lat + i * lat_step
            lng = center_lng + j * lng_step
            dist_m = math.sqrt(
                (i * spacing_m) ** 2 + (j * spacing_m) ** 2
            )
            if dist_m <= radius_m:
                points.append((lat, lng))
    return points


def search_nearby(api_key, lat, lng, place_type, radius):
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": FIELD_MASK,
        "Content-Type": "application/json",
    }
    body = {
        "includedTypes": [place_type],
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius),
            }
        },
    }
    resp = requests.post(PLACES_URL, json=body, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json().get("places", [])


def extract_component(address_components, *target_types):
    for target_type in target_types:
        for comp in address_components:
            if target_type in comp.get("types", []):
                return comp["longText"]
    return None


def make_slug(name, city_id, existing_slugs):
    base = (slugify(name) or "venue")[:46]  # leave room for -NNN dedup suffix
    slug = base
    counter = 2
    while (city_id, slug) in existing_slugs:
        slug = f"{base}-{counter}"
        counter += 1
    existing_slugs.add((city_id, slug))
    return slug


class Command(BaseCommand):
    help = "Seed venues from Google Places API for a metro area"

    def add_arguments(self, parser):
        parser.add_argument("--lat", type=float, default=41.8827)
        parser.add_argument("--lng", type=float, default=-87.6233)
        parser.add_argument("--radius", type=int, default=40, help="Radius in miles")
        parser.add_argument("--spacing", type=int, default=2000, help="Grid spacing in meters")
        parser.add_argument("--search-radius", type=int, default=1500, help="Search radius per point in meters")
        parser.add_argument("--timezone", default="America/Chicago")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--resume", action="store_true", help="Skip place_ids already in DB")
        parser.add_argument("--api-key", default=None)

    def handle(self, *args, **options):
        api_key = options["api_key"] or os.environ.get("GOOGLE_PLACES_API_KEY")
        if not api_key:
            self.stderr.write(self.style.ERROR(
                "Provide --api-key or set GOOGLE_PLACES_API_KEY"
            ))
            return

        center_lat = options["lat"]
        center_lng = options["lng"]
        radius_m = int(options["radius"] * MILES_TO_METERS)
        spacing_m = options["spacing"]
        search_radius = options["search_radius"]
        tz = options["timezone"]
        dry_run = options["dry_run"]
        resume = options["resume"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no database writes\n"))

        grid = build_grid(center_lat, center_lng, radius_m, spacing_m)
        self.stdout.write(
            f"Grid: {len(grid)} points  |  radius={options['radius']}mi  |  "
            f"spacing={spacing_m}m  |  search_radius={search_radius}m"
        )

        existing_ids: set[str] = set()
        if resume:
            existing_ids = set(
                Venue.objects.exclude(google_place_id=None)
                .values_list("google_place_id", flat=True)
            )
            self.stdout.write(f"Resume mode: {len(existing_ids)} venues already in DB\n")

        # ── Step 1: collect all unique places ────────────────────────────────
        seen: dict[str, dict] = {}
        total_calls = 0
        error_count = 0

        for idx, (lat, lng) in enumerate(grid, 1):
            for place_type in ("bar", "night_club"):
                try:
                    places = search_nearby(api_key, lat, lng, place_type, search_radius)
                    total_calls += 1
                    for p in places:
                        pid = p.get("id")
                        if pid and pid not in seen:
                            seen[pid] = p
                except requests.HTTPError as exc:
                    error_count += 1
                    if error_count <= 10:
                        self.stderr.write(
                            f"  HTTP {exc.response.status_code} at "
                            f"({lat:.4f},{lng:.4f}) {place_type}: {exc}"
                        )
                    if exc.response.status_code == 429:
                        time.sleep(5)
                except Exception as exc:  # noqa: BLE001
                    error_count += 1
                    if error_count <= 10:
                        self.stderr.write(f"  Error at ({lat:.4f},{lng:.4f}) {place_type}: {exc}")

                time.sleep(0.12)  # stay well under 10 req/s

            if idx % 100 == 0 or idx == len(grid):
                self.stdout.write(
                    f"  {idx}/{len(grid)} points  |  "
                    f"{len(seen)} unique places  |  "
                    f"{total_calls} calls  |  {error_count} errors"
                )

        self.stdout.write(f"\nCollection complete: {len(seen)} unique places\n")

        if dry_run:
            counts: dict[str, int] = {}
            for p in seen.values():
                loc = extract_component(
                    p.get("addressComponents", []),
                    "locality", "sublocality", "administrative_area_level_3",
                ) or "Unknown"
                counts[loc] = counts.get(loc, 0) + 1
            self.stdout.write("Venues by city (top 25):")
            for city_name, n in sorted(counts.items(), key=lambda x: -x[1])[:25]:
                self.stdout.write(f"  {city_name}: {n}")
            return

        # ── Step 2: upsert cities and venues ─────────────────────────────────
        city_cache: dict[str, City] = {}
        existing_slugs: set[tuple] = set(Venue.objects.values_list("city_id", "slug"))

        created_cities = 0
        created_venues = 0
        updated_venues = 0
        skipped = 0
        no_city = 0

        for place_id, place in seen.items():
            if resume and place_id in existing_ids:
                skipped += 1
                continue

            components = place.get("addressComponents", [])
            locality = extract_component(
                components,
                "locality", "sublocality", "administrative_area_level_3",
            )
            if not locality:
                no_city += 1
                continue

            city_slug = slugify(locality)
            if not city_slug:
                no_city += 1
                continue

            location = place.get("location", {})
            p_lat = location.get("latitude", center_lat)
            p_lng = location.get("longitude", center_lng)

            if city_slug not in city_cache:
                city, city_created = City.objects.get_or_create(
                    slug=city_slug,
                    defaults={"name": locality, "lat": p_lat, "lng": p_lng},
                )
                city_cache[city_slug] = city
                if city_created:
                    created_cities += 1
            city = city_cache[city_slug]

            name = place.get("displayName", {}).get("text", "")
            if not name:
                continue

            neighborhood = extract_component(components, "neighborhood", "sublocality_level_1") or ""
            google_price = PRICE_MAP.get(place.get("priceLevel", ""))

            venue_defaults = {
                "name": name,
                "address": place.get("formattedAddress", ""),
                "neighborhood": neighborhood,
                "lat": p_lat,
                "lng": p_lng,
                "google_price_level": google_price,
                "timezone": tz,
                "city": city,
            }

            try:
                venue = Venue.objects.get(google_place_id=place_id)
                for k, v in venue_defaults.items():
                    setattr(venue, k, v)
                venue.save()
                venue.recompute_price(save=True)
                updated_venues += 1
            except Venue.DoesNotExist:
                slug = make_slug(name, city.id, existing_slugs)
                try:
                    venue = Venue.objects.create(
                        google_place_id=place_id,
                        slug=slug,
                        **venue_defaults,
                    )
                    venue.recompute_price(save=True)
                    created_venues += 1
                except Exception as exc:  # noqa: BLE001
                    self.stderr.write(f"  Skipped '{name}': {exc}")
                    existing_slugs.discard((city.id, slug))

        # ── Step 3: refresh denormalized venue_count ─────────────────────────
        for city in city_cache.values():
            city.venue_count = city.venues.count()
            city.save(update_fields=["venue_count"])

        self.stdout.write(self.style.SUCCESS(
            f"Done:\n"
            f"  {created_cities} new cities\n"
            f"  {created_venues} new venues created\n"
            f"  {updated_venues} venues updated\n"
            f"  {skipped} skipped (resume)\n"
            f"  {no_city} dropped (no locality)\n"
        ))

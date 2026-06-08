import json
from pathlib import Path

from django.core.management.base import BaseCommand
from shapely.geometry import Point, shape
from shapely.prepared import prep

from apps.venues.models import Venue

# Bundled in the app so it's available inside the container (which only mounts
# ./backend). Default is the Chicago ~98-neighborhood set (pri_neigh names).
DEFAULT_GEOJSON = Path(__file__).resolve().parents[2] / "data" / "n.geojson"


class Command(BaseCommand):
    help = (
        "Assign venue.neighborhood by point-in-polygon against a neighborhood "
        "GeoJSON. Free, no API. Venues outside every polygon are left unchanged."
    )

    def add_arguments(self, parser):
        parser.add_argument("--geojson", default=str(DEFAULT_GEOJSON))
        parser.add_argument(
            "--city-slug",
            default="chicago-il",
            help="Only assign venues in this city. Use 'all' for every venue.",
        )
        parser.add_argument(
            "--name-prop",
            default="pri_neigh",
            help="GeoJSON feature property holding the neighborhood name.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        path = Path(opts["geojson"])
        if not path.exists():
            self.stderr.write(self.style.ERROR(f"GeoJSON not found: {path}"))
            return

        data = json.loads(path.read_text(encoding="utf-8"))
        name_prop = opts["name_prop"]

        # (name, prepared polygon) — prep() makes repeated point-in-polygon fast.
        polygons = []
        for feat in data.get("features", []):
            name = (feat.get("properties") or {}).get(name_prop)
            geom = shape(feat["geometry"])
            if name and geom.is_valid:
                polygons.append((name, prep(geom)))
        self.stdout.write(f"Loaded {len(polygons)} polygons from {path.name}")
        if not polygons:
            self.stderr.write(self.style.ERROR(f"No polygons with '{name_prop}'."))
            return

        qs = Venue.objects.exclude(lat__isnull=True).exclude(lng__isnull=True)
        if opts["city_slug"] != "all":
            qs = qs.filter(city__slug=opts["city_slug"])
        self.stdout.write(f"Scanning {qs.count()} venues (city={opts['city_slug']})")

        matched = 0
        outside = 0
        changed = []
        for venue in qs.iterator():
            point = Point(float(venue.lng), float(venue.lat))
            hood = next(
                (name for name, poly in polygons if poly.contains(point)), None
            )
            if hood is None:
                outside += 1
                continue
            matched += 1
            if venue.neighborhood != hood:
                venue.neighborhood = hood
                changed.append(venue)

        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING(
                f"DRY RUN — {matched} inside a neighborhood, {outside} outside, "
                f"{len(changed)} would be updated."
            ))
            return

        Venue.objects.bulk_update(changed, ["neighborhood"], batch_size=500)
        self.stdout.write(self.style.SUCCESS(
            f"Done — {matched} inside a neighborhood, {outside} outside, "
            f"{len(changed)} updated."
        ))

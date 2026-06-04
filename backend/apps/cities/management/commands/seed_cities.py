"""Seed incorporated US cities from the Census Gazetteer (public domain).

Tab-delimited file: USPS, GEOID, ANSICODE, NAME, LSAD, FUNCSTAT, ...,
INTPTLAT, INTPTLONG. We keep FUNCSTAT == 'A' (incorporated places), strip the
LSAD suffix from NAME, and build "<city>-<state>" slugs. Existing venue-seeded
cities (state == '') are reconciled by name + nearest coordinates so their
venues stay attached and we don't create duplicates.
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.cities.models import City

DEFAULT_FILE = "/app/data/2024_Gaz_place_national.txt"

# Trailing LSAD descriptors in NAME (longest first), e.g. "Abbeville city".
NAME_SUFFIXES = [
    " consolidated government",
    " metropolitan government",
    " unified government",
    " metro government",
    " city and borough",
    " urban county",
    " municipality",
    " borough",
    " village",
    " town",
    " city",
]


def clean_name(name):
    for suffix in NAME_SUFFIXES:
        if name.endswith(suffix):
            return name[: -len(suffix)].strip()
    return name.strip()


def normalize(name):
    """Loose key for matching legacy cities to Census (e.g. 'Saint John' / 'St. John')."""
    n = name.lower().replace(".", "").strip()
    if n.startswith("saint "):
        n = "st " + n[6:]
    return n


class Command(BaseCommand):
    help = "Seed incorporated US cities from a Census Gazetteer places file."

    def add_arguments(self, parser):
        parser.add_argument("--file", default=DEFAULT_FILE)
        parser.add_argument("--limit", type=int, default=None)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        rows = self._parse(opts["file"])
        if opts["limit"]:
            rows = rows[: opts["limit"]]
        self.stdout.write(f"Parsed {len(rows)} incorporated places")

        # Legacy cities (not yet given a state) indexed by lowercased name.
        legacy = {}
        for c in City.objects.filter(state=""):
            legacy.setdefault(normalize(c.name), []).append(c)

        existing_slugs = set(City.objects.values_list("slug", flat=True))
        seen = set(existing_slugs)  # all taken slugs (existing + created this run)
        to_create, created, updated, skipped = [], 0, 0, 0

        for name, state, lat, lng in rows:
            match = self._match_legacy(legacy, name, lat, lng)
            if match:
                slug = self._unique_slug(name, state, seen)
                updated += 1
                if not opts["dry_run"]:
                    match.name, match.state, match.slug = name, state, slug
                    match.lat, match.lng = lat, lng
                    match.save(update_fields=["name", "state", "slug", "lat", "lng"])
                continue
            if (slugify(f"{name}-{state}") or "city") in existing_slugs:
                skipped += 1  # already seeded on a prior run → idempotent
                continue
            slug = self._unique_slug(name, state, seen)
            created += 1
            to_create.append(City(name=name, state=state, slug=slug, lat=lat, lng=lng))

        if not opts["dry_run"] and to_create:
            City.objects.bulk_create(to_create, batch_size=1000, ignore_conflicts=True)

        leftover = sum(len(v) for v in legacy.values())
        prefix = "[DRY RUN] " if opts["dry_run"] else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}created {created}, reconciled {updated} existing, "
            f"skipped {skipped} | {leftover} legacy cities left unmatched"
        ))

    def _parse(self, path):
        # One entry per (name, state): some states list e.g. "Waukesha city" and
        # "Waukesha town" — both incorporated — which collapse to the same name
        # after stripping the descriptor. Keep the larger place (by land area).
        best = {}
        with open(path, encoding="utf-8") as f:
            header = [h.strip() for h in f.readline().split("\t")]
            idx = {h: i for i, h in enumerate(header)}
            for line in f:
                c = line.rstrip("\n").split("\t")
                if c[idx["FUNCSTAT"]].strip() != "A":
                    continue
                try:
                    lat = float(c[idx["INTPTLAT"]])
                    lng = float(c[idx["INTPTLONG"]])
                    aland = int(c[idx["ALAND"]] or 0)
                except ValueError:
                    continue
                name, state = clean_name(c[idx["NAME"]]), c[idx["USPS"]].strip()
                key = (name, state)
                if key not in best or aland > best[key][0]:
                    best[key] = (aland, name, state, lat, lng)
        return [(n, s, la, lo) for _, n, s, la, lo in best.values()]

    def _match_legacy(self, legacy, name, lat, lng):
        cands = legacy.get(normalize(name))
        if not cands:
            return None
        # Nearest same-name place, capped at ~70mi (handles big cities whose
        # stored coords are a venue point far from the Census centroid). The
        # name guard makes a wrong-state match effectively impossible here.
        best, best_d = None, 1.0
        for c in cands:
            d = (float(c.lat) - lat) ** 2 + (float(c.lng) - lng) ** 2
            if d < best_d:
                best, best_d = c, d
        if best:
            cands.remove(best)
        return best

    def _unique_slug(self, name, state, used):
        base = slugify(f"{name}-{state}") or "city"
        slug, n = base, 2
        while slug in used:
            slug = f"{base}-{n}"
            n += 1
        used.add(slug)
        return slug

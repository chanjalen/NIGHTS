"""Merge legacy state-less duplicate cities into their Census counterparts.

seed_venues used to create cities keyed by the bare locality slug (e.g.
`chicago`). seed_cities later renamed those rows to `<city>-<state>` (e.g.
`chicago-il`), so a subsequent seed_venues run no longer found the bare slug
and re-created the city, attaching new venues to the duplicate. This command
moves venues, venue requests, and users' home_city off each state-less
duplicate onto its stateful twin (matched by name + nearest coordinates, same
rules as seed_cities), then deletes the duplicate. State-less cities with no
twin (unincorporated places the Census file doesn't carry) are left alone.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.cities.management.commands.seed_cities import normalize
from apps.cities.models import City
from apps.venues.models import Venue, VenueRequest


class Command(BaseCommand):
    help = "Merge state-less duplicate cities into their stateful twins."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        dry_run = opts["dry_run"]
        prefix = "[DRY RUN] " if dry_run else ""
        merged = 0

        for dup in City.objects.filter(state=""):
            target = self._find_twin(dup)
            if target is None:
                self.stdout.write(f"{dup.slug}: no stateful twin, leaving as-is")
                continue

            venue_count = dup.venues.count()
            request_count = VenueRequest.objects.filter(city=dup).count()
            resident_count = User.objects.filter(home_city=dup).count()
            self.stdout.write(
                f"{prefix}{dup.slug} -> {target.slug}: moving {venue_count} venues, "
                f"{request_count} venue requests, {resident_count} residents"
            )
            merged += 1
            if dry_run:
                continue

            with transaction.atomic():
                self._move_venues(dup, target)
                VenueRequest.objects.filter(city=dup).update(city=target)
                User.objects.filter(home_city=dup).update(home_city=target)
                dup.delete()
                target.venue_count = target.venues.count()
                target.save(update_fields=["venue_count"])

        self.stdout.write(self.style.SUCCESS(f"{prefix}merged {merged} duplicates"))

    def _find_twin(self, dup):
        # Same matching rules as seed_cities: identical normalized name, nearest
        # coordinates, capped at ~70mi.
        best, best_d = None, 1.0
        for cand in City.objects.exclude(state="").exclude(pk=dup.pk):
            if normalize(cand.name) != normalize(dup.name):
                continue
            d = (float(cand.lat) - float(dup.lat)) ** 2 + (
                float(cand.lng) - float(dup.lng)
            ) ** 2
            if d < best_d:
                best, best_d = cand, d
        return best

    def _move_venues(self, dup, target):
        # Venue slugs are unique per city, so re-slug on collision.
        taken = set(target.venues.values_list("slug", flat=True))
        for venue in dup.venues.all():
            slug = venue.slug
            if slug in taken:
                base = slug[:46]
                n = 2
                while f"{base}-{n}" in taken:
                    n += 1
                slug = f"{base}-{n}"
            taken.add(slug)
            venue.slug = slug
            venue.city = target
            venue.save(update_fields=["city", "slug"])

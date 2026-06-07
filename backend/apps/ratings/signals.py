from django.db.models import Avg, Count
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from . import s3
from .models import Rating, RatingMedia


def _recompute_venue_rating(venue):
    agg = venue.ratings.aggregate(avg=Avg("overall"), count=Count("id"))
    venue.overall_rating = round(agg["avg"] or 0, 2)
    venue.total_ratings = agg["count"]
    venue.recompute_price()  # sets venue.price_level from Google + rating prices
    venue.save(update_fields=["overall_rating", "total_ratings", "price_level"])


@receiver(post_save, sender=Rating)
def on_rating_save(sender, instance, **kwargs):
    _recompute_venue_rating(instance.venue)


@receiver(post_delete, sender=Rating)
def on_rating_delete(sender, instance, **kwargs):
    _recompute_venue_rating(instance.venue)


@receiver(post_delete, sender=RatingMedia)
def on_media_delete(sender, instance, **kwargs):
    # Best-effort S3 cleanup when a media row is deleted (e.g. its rating was
    # deleted via cascade). Never let storage errors break the delete.
    try:
        s3.delete_prefix(s3.media_prefix(instance.id))
    except Exception:  # noqa: BLE001
        pass
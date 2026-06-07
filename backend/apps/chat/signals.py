from django.db.models.signals import post_delete
from django.dispatch import receiver
from apps.ratings import s3
from .models import MessageMedia


@receiver(post_delete, sender=MessageMedia)
def on_message_media_delete(sender, instance, **kwargs):
    # Best-effort S3 cleanup when a chat media row is deleted (e.g. its message
    # was deleted via cascade). Mirrors apps.ratings.signals.on_media_delete.
    # Never let storage errors break the delete.
    try:
        s3.delete_prefix(s3.media_prefix(instance.id, base=s3.CHAT_MEDIA_PREFIX))
    except Exception:  # noqa: BLE001
        pass

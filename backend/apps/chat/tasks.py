"""Async processing for chat media. Mirrors review processing but: stores object
keys only (URLs are signed on read — private media), outputs under
``chat-media/<id>/``, and on completion **pushes the finished media to everyone
in the room** via the Channels group (real-time resolve)."""
import os
import tempfile

from asgiref.sync import async_to_sync
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from channels.layers import get_channel_layer
from django.conf import settings

from apps import media_processing
from apps.ratings import s3
from .models import MessageMedia


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=120,
    time_limit=150,
)
def process_message_media(self, media_id):
    try:
        media = MessageMedia.objects.select_related("message").get(id=media_id)
    except MessageMedia.DoesNotExist:
        return
    if media.status != MessageMedia.PROCESSING:
        return

    max_bytes = (
        settings.MEDIA_MAX_IMAGE_BYTES
        if media.media_type == MessageMedia.IMAGE
        else settings.MEDIA_CHAT_MAX_VIDEO_BYTES
    )
    size = s3.object_size(media.original_key)
    if size is None or size > max_bytes:
        media.status = MessageMedia.FAILED
        media.save(update_fields=["status"])
        s3.delete_object(media.original_key)
        return

    raw_key = media.original_key
    src = paths = None
    try:
        src = _download(raw_key)
        res = media_processing.produce_derivatives(
            src, media.media_type, settings.MEDIA_CHAT_MAX_VIDEO_SECONDS
        )
        paths = (res["main_path"], res["thumb_path"])
        prefix = s3.media_prefix(media.id, base=s3.CHAT_MEDIA_PREFIX)
        if res["final_type"] == "image":
            main_key, thumb_key = f"{prefix}image.jpg", f"{prefix}thumb.jpg"
        else:
            main_key, thumb_key = f"{prefix}video.mp4", f"{prefix}poster.jpg"
        _upload(res["main_path"], main_key, res["main_content_type"])
        _upload(res["thumb_path"], thumb_key, "image/jpeg")

        media.media_type = res["final_type"]  # animated GIF → video
        media.original_key = main_key
        media.thumbnail_key = thumb_key
        media.width, media.height = res["width"], res["height"]
        media.duration_ms = res["duration_ms"]
        media.status = MessageMedia.READY
        media.save()
        s3.delete_object(raw_key)
        _push_ready(media)
    except SoftTimeLimitExceeded:
        media.status = MessageMedia.FAILED
        media.save(update_fields=["status"])
        s3.delete_object(raw_key)
    except Exception as exc:  # noqa: BLE001
        media.status = MessageMedia.FAILED
        media.save(update_fields=["status"])
        raise self.retry(exc=exc)
    finally:
        media_processing.safe_unlink(src)
        for p in paths or ():
            media_processing.safe_unlink(p)


def _push_ready(media: MessageMedia) -> None:
    """Broadcast the finished media to the room. Mint ONE signed URL per object
    (cached) and include it so consumers just relay — O(1) signing for large rooms."""
    venue_id = str(media.message.venue_id)
    group = f"venue_chat_{venue_id.replace('-', '_')}"
    payload = {
        "id": str(media.id),
        "media_type": media.media_type,
        "file_url": s3.signed_cdn_url(media.original_key),
        "thumbnail_url": s3.signed_cdn_url(media.thumbnail_key) if media.thumbnail_key else "",
        "width": media.width,
        "height": media.height,
        "duration_ms": media.duration_ms,
    }
    async_to_sync(get_channel_layer().group_send)(
        group,
        {"type": "media.ready", "message_id": str(media.message_id), "media": payload},
    )


def _download(key: str) -> str:
    fd, path = tempfile.mkstemp(suffix=os.path.splitext(key)[1])
    os.close(fd)
    s3.get_s3_client().download_file(settings.AWS_S3_BUCKET, key, path)
    return path


def _upload(path: str, key: str, content_type: str) -> None:
    s3.get_s3_client().upload_file(
        path,
        settings.AWS_S3_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type, "CacheControl": "private, max-age=86400"},
    )

"""Async processing for review media. Pulls the raw upload from S3, produces
browser-safe derivatives (shared with chat via ``apps.media_processing``),
uploads them under ``review-media/<id>/``, then flips the row to ``ready``.
"""
import os
import tempfile

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings

from apps import media_processing
from . import s3
from .models import RatingMedia


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=180,
    time_limit=210,
)
def process_media(self, media_id):
    try:
        media = RatingMedia.objects.get(id=media_id)
    except RatingMedia.DoesNotExist:
        return
    if media.status != RatingMedia.PROCESSING:
        return

    # Defense-in-depth size guard (presigned-POST policy already caps at upload).
    max_bytes = (
        settings.MEDIA_MAX_IMAGE_BYTES
        if media.media_type == RatingMedia.IMAGE
        else settings.MEDIA_MAX_VIDEO_BYTES
    )
    size = s3.object_size(media.original_key)
    if size is None or size > max_bytes:
        media.status = RatingMedia.FAILED
        media.save(update_fields=["status"])
        s3.delete_object(media.original_key)
        return

    raw_key = media.original_key
    src = paths = None
    try:
        src = _download(raw_key)
        res = media_processing.produce_derivatives(
            src, media.media_type, settings.MEDIA_MAX_VIDEO_SECONDS
        )
        paths = (res["main_path"], res["thumb_path"])
        prefix = s3.media_prefix(media.id)
        if res["final_type"] == "image":
            main_key, thumb_key = f"{prefix}image.jpg", f"{prefix}thumb.jpg"
        else:
            main_key, thumb_key = f"{prefix}video.mp4", f"{prefix}poster.jpg"
        _upload(res["main_path"], main_key, res["main_content_type"])
        _upload(res["thumb_path"], thumb_key, "image/jpeg")

        media.media_type = res["final_type"]  # animated GIF → video
        media.original_key = main_key
        media.file_url = s3.cdn_url(main_key)
        media.thumbnail_url = s3.cdn_url(thumb_key)
        media.width, media.height = res["width"], res["height"]
        media.duration_ms = res["duration_ms"]
        media.status = RatingMedia.READY
        media.save()
        s3.delete_object(raw_key)
    except SoftTimeLimitExceeded:
        media.status = RatingMedia.FAILED
        media.save(update_fields=["status"])
        s3.delete_object(raw_key)
    except Exception as exc:  # noqa: BLE001
        media.status = RatingMedia.FAILED
        media.save(update_fields=["status"])
        raise self.retry(exc=exc)
    finally:
        media_processing.safe_unlink(src)
        for p in paths or ():
            media_processing.safe_unlink(p)


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
        ExtraArgs={
            "ContentType": content_type,
            "CacheControl": "public, max-age=31536000",
        },
    )

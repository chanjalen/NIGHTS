"""Shared helpers for classifying review-media by content-type / extension."""
from django.conf import settings

from .models import RatingMedia


def ext_for_content_type(content_type: str):
    """File extension for an allowed image/video content-type, else None."""
    return (
        settings.MEDIA_ALLOWED_IMAGE_TYPES.get(content_type)
        or settings.MEDIA_ALLOWED_VIDEO_TYPES.get(content_type)
    )


def media_type_for_content_type(content_type: str):
    if content_type in settings.MEDIA_ALLOWED_IMAGE_TYPES:
        return RatingMedia.IMAGE
    if content_type in settings.MEDIA_ALLOWED_VIDEO_TYPES:
        return RatingMedia.VIDEO
    return None


def media_type_for_key(key: str):
    """Infer image/video from a stored object key's extension."""
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    if ext in set(settings.MEDIA_ALLOWED_IMAGE_TYPES.values()):
        return RatingMedia.IMAGE
    if ext in set(settings.MEDIA_ALLOWED_VIDEO_TYPES.values()):
        return RatingMedia.VIDEO
    return None

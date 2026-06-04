"""Thin boto3 helpers for review-media storage on S3 + CloudFront.

Uploads go direct-to-S3 via presigned PUT URLs; the Celery worker reads/writes
processed files with the same client. Public reads are served through the
CloudFront domain, so the bucket itself stays private.
"""
import datetime

import boto3
from botocore.config import Config
from botocore.signers import CloudFrontSigner
from django.conf import settings

UNCONFIRMED_PREFIX = "unconfirmed"
MEDIA_PREFIX = "review-media"
CHAT_UNCONFIRMED_PREFIX = "chat-unconfirmed"
CHAT_MEDIA_PREFIX = "chat-media"

_cf_private_key = None  # cached parsed CloudFront private key


def is_configured() -> bool:
    """True only when S3 credentials + bucket are present."""
    return bool(
        settings.AWS_S3_BUCKET
        and settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
    )


def get_s3_client():
    endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", "")
    kwargs = dict(
        region_name=settings.AWS_S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    if endpoint:
        # Local/dev S3-compatible store (e.g. MinIO) needs path-style addressing.
        kwargs["endpoint_url"] = endpoint
        kwargs["config"] = Config(
            signature_version="s3v4", s3={"addressing_style": "path"}
        )
    else:
        # Force the regional endpoint so presigned-URL hosts include the region.
        # Without this, boto3 emits the global `bucket.s3.amazonaws.com` host
        # while signing for the bucket's region → SignatureDoesNotMatch.
        kwargs["endpoint_url"] = f"https://s3.{settings.AWS_S3_REGION}.amazonaws.com"
        kwargs["config"] = Config(
            signature_version="s3v4", s3={"addressing_style": "virtual"}
        )
    return boto3.client("s3", **kwargs)


def cdn_url(key: str) -> str:
    """Public URL for an object key, served via CloudFront."""
    domain = settings.AWS_CLOUDFRONT_DOMAIN.rstrip("/")
    return f"https://{domain}/{key}"


def _cf_signing_configured() -> bool:
    return bool(
        settings.AWS_CLOUDFRONT_KEY_PAIR_ID
        and (settings.AWS_CLOUDFRONT_PRIVATE_KEY or settings.AWS_CLOUDFRONT_PRIVATE_KEY_FILE)
    )


def _load_cf_private_key():
    global _cf_private_key
    if _cf_private_key is None:
        from cryptography.hazmat.primitives import serialization

        if settings.AWS_CLOUDFRONT_PRIVATE_KEY:
            pem = settings.AWS_CLOUDFRONT_PRIVATE_KEY.replace("\\n", "\n").encode()
        else:
            with open(settings.AWS_CLOUDFRONT_PRIVATE_KEY_FILE, "rb") as f:
                pem = f.read()
        _cf_private_key = serialization.load_pem_private_key(pem, password=None)
    return _cf_private_key


def _cf_rsa_signer(message: bytes) -> bytes:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding

    return _load_cf_private_key().sign(message, padding.PKCS1v15(), hashes.SHA1())


def signed_cdn_url(key: str, ttl: int | None = None) -> str:
    """A time-limited signed CloudFront URL for private (chat) media.

    Falls back to an unsigned URL when signing isn't configured (dev/MinIO), so
    local testing still works. Result is cached per key for (almost) the TTL so a
    big room reuses one URL (O(1) signing, better CDN/browser caching)."""
    if not _cf_signing_configured():
        return cdn_url(key)

    from django.core.cache import cache

    ttl = ttl or settings.MEDIA_SIGNED_URL_TTL
    cache_key = f"signedurl:{key}"
    if cached := cache.get(cache_key):
        return cached

    signer = CloudFrontSigner(settings.AWS_CLOUDFRONT_KEY_PAIR_ID, _cf_rsa_signer)
    expire = datetime.datetime.utcnow() + datetime.timedelta(seconds=ttl)
    url = signer.generate_presigned_url(cdn_url(key), date_less_than=expire)
    cache.set(cache_key, url, timeout=max(ttl - 60, 60))
    return url


def presign_post(key: str, content_type: str, max_bytes: int, expires: int = 300) -> dict:
    """A short-lived presigned POST constrained to one key, content-type, and a
    hard max size. Unlike presigned PUT, the ``content-length-range`` policy makes
    S3 itself reject oversized uploads at the edge.

    Returns ``{"url": ..., "fields": {...}}`` for a multipart form POST.
    """
    return get_s3_client().generate_presigned_post(
        Bucket=settings.AWS_S3_BUCKET,
        Key=key,
        Fields={"Content-Type": content_type},
        Conditions=[
            {"Content-Type": content_type},
            ["content-length-range", 1, max_bytes],
        ],
        ExpiresIn=expires,
    )


def object_exists(key: str) -> bool:
    client = get_s3_client()
    try:
        client.head_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
        return True
    except client.exceptions.ClientError:
        return False


def object_size(key: str) -> int | None:
    client = get_s3_client()
    try:
        head = client.head_object(Bucket=settings.AWS_S3_BUCKET, Key=key)
        return head["ContentLength"]
    except client.exceptions.ClientError:
        return None


def delete_object(key: str) -> None:
    if not key:
        return
    get_s3_client().delete_object(Bucket=settings.AWS_S3_BUCKET, Key=key)


def delete_prefix(prefix: str) -> None:
    """Delete every object under a prefix (all files for one media item)."""
    if not prefix:
        return
    client = get_s3_client()
    resp = client.list_objects_v2(Bucket=settings.AWS_S3_BUCKET, Prefix=prefix)
    keys = [{"Key": obj["Key"]} for obj in resp.get("Contents", [])]
    if keys:
        client.delete_objects(
            Bucket=settings.AWS_S3_BUCKET, Delete={"Objects": keys}
        )


def media_prefix(media_id, base: str = MEDIA_PREFIX) -> str:
    return f"{base}/{media_id}/"

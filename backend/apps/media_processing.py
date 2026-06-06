"""Pure media transforms — no S3, no Django models.

Takes a local source file, produces local derivative files + metadata. Shared by
review media (``apps.ratings.tasks``) and chat media (``apps.chat.tasks``) so both
get identical, hardened processing.
"""
import os
import tempfile

import ffmpeg
from PIL import Image

# HEIC/HEIF support so Pillow can open iPhone photos.
try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # noqa: BLE001
    pass

IMAGE_MAX_DIM = 1600
THUMB_MAX_DIM = 400
JPEG_QUALITY = 85
# Hard cap on decoded pixels — defuses decompression-bomb files (tiny upload that
# expands to billions of pixels).
MAX_IMAGE_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
# ffmpeg: only read the local temp file (+crypto for some MP4s). Blocks
# http/concat/HLS protocol tricks (SSRF / local-file read).
FFMPEG_PROTOCOLS = "file,crypto"


# Formats that carry real animation and should become an MP4. MPO and other
# multi-frame *stills* must be excluded: iPhone HDR photos bundle a gain-map as
# a 2nd frame (format "MPO", n_frames=2), and without this guard an ordinary
# photo gets misclassified as animated and transcoded into a video.
ANIMATED_FORMATS = {"GIF", "PNG", "WEBP"}


def is_animated(src_path: str) -> bool:
    """True only for genuinely animated images (e.g. an animated GIF)."""
    try:
        with Image.open(src_path) as im:
            if im.format not in ANIMATED_FORMATS:
                return False
            return getattr(im, "is_animated", False) and getattr(im, "n_frames", 1) > 1
    except Exception:  # noqa: BLE001
        return False


def produce_derivatives(src_path: str, declared_type: str, video_max_seconds: int) -> dict:
    """Turn a raw upload into browser-safe derivatives.

    Routing: static image → JPEG; video OR *animated* GIF → H.264 MP4. So an
    animated GIF uploaded as an image comes back as ``final_type='video'``.

    Returns: ``{final_type, main_path, main_content_type, thumb_path, width,
    height, duration_ms}``. Caller uploads main+thumb and persists the fields.
    """
    if declared_type == "image" and not is_animated(src_path):
        full, thumb, width, height = _process_image(src_path)
        return {
            "final_type": "image",
            "main_path": full,
            "main_content_type": "image/jpeg",
            "thumb_path": thumb,
            "width": width,
            "height": height,
            "duration_ms": None,
        }

    # video, or animated GIF (no audio) → MP4
    with_audio = declared_type == "video"
    mp4, poster, width, height, duration_ms = _transcode_to_mp4(
        src_path, video_max_seconds, with_audio=with_audio
    )
    return {
        "final_type": "video",
        "main_path": mp4,
        "main_content_type": "video/mp4",
        "thumb_path": poster,
        "width": width,
        "height": height,
        "duration_ms": duration_ms,
    }


def _process_image(src_path):
    with Image.open(src_path) as im:
        # Reject decompression bombs before decoding pixels (header gives size).
        if im.width * im.height > MAX_IMAGE_PIXELS:
            raise ValueError("image exceeds max pixel count")
        im = _flatten_to_rgb(im)  # alpha → white, EXIF/GPS dropped

        full = im.copy()
        full.thumbnail((IMAGE_MAX_DIM, IMAGE_MAX_DIM))
        width, height = full.size
        full_path = _tmp(".jpg")
        full.save(full_path, "JPEG", quality=JPEG_QUALITY)

        thumb = im.copy()
        thumb.thumbnail((THUMB_MAX_DIM, THUMB_MAX_DIM))
        thumb_path = _tmp(".jpg")
        thumb.save(thumb_path, "JPEG", quality=JPEG_QUALITY)
    return full_path, thumb_path, width, height


def _transcode_to_mp4(src_path, max_seconds, with_audio):
    duration = float(
        ffmpeg.probe(src_path, protocol_whitelist=FFMPEG_PROTOCOLS)
        .get("format", {})
        .get("duration")
        or 0
    )
    clamp = min(duration, max_seconds) if duration else max_seconds

    out_path = _tmp(".mp4")
    kwargs = dict(
        vcodec="libx264",
        pix_fmt="yuv420p",
        movflags="+faststart",
        preset="veryfast",
        crf=24,
        map_metadata=-1,  # strip EXIF/GPS/device metadata
        vf="scale=trunc(iw/2)*2:trunc(ih/2)*2",  # H.264 needs even dimensions
        **{"loglevel": "error"},
    )
    if with_audio:
        kwargs["acodec"] = "aac"
    else:
        kwargs["an"] = None  # -an: drop audio (e.g. GIF)
    (
        ffmpeg.input(src_path, t=clamp, protocol_whitelist=FFMPEG_PROTOCOLS)
        .output(out_path, **kwargs)
        .global_args("-nostdin")
        .overwrite_output()
        .run()
    )

    out = ffmpeg.probe(out_path)
    vstream = next((s for s in out["streams"] if s["codec_type"] == "video"), {})
    width = int(vstream.get("width") or 0) or None
    height = int(vstream.get("height") or 0) or None
    duration_ms = int(float(out.get("format", {}).get("duration") or clamp) * 1000)

    poster_path = _tmp(".jpg")
    (
        ffmpeg.input(out_path, ss=min(1.0, clamp / 2))
        .output(poster_path, vframes=1, **{"loglevel": "error"})
        .overwrite_output()
        .run()
    )
    return out_path, poster_path, width, height, duration_ms


def _flatten_to_rgb(im):
    """RGB, compositing any transparency onto white (not black)."""
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def _tmp(suffix):
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    return path


def safe_unlink(path):
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass

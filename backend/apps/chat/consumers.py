import json
import time
from collections import deque

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.conf import settings
from django.utils import timezone

# Anti-flood: max messages a single connection may send per window.
SEND_LIMIT = 15
SEND_WINDOW = 10.0  # seconds


class VenueChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from apps.common import parse_uuid

        venue_id = parse_uuid(self.scope["url_route"]["kwargs"]["venue_id"])
        if not venue_id:
            await self.close(code=4004)
            return
        self.venue_id = str(venue_id)
        self.group_name = f"venue_chat_{self.venue_id.replace('-', '_')}"
        self._sends: deque[float] = deque()

        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        if not await self._has_checkin(user, self.venue_id):
            await self.close(code=4003)
            return

        self.user = user
        self.venue = await self._get_venue(self.venue_id)

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        history = await self._get_history()
        await self.send(text_data=json.dumps({"type": "history", "messages": history}))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        text = (data.get("text") or "").strip()[:280]
        media_key = data.get("media_key")
        if not text and not media_key:
            return

        if not self._allow_send():
            await self.send(text_data=json.dumps({"type": "error", "code": "rate_limited"}))
            return

        if not await self._has_checkin(self.user, self.venue_id):
            await self.send(text_data=json.dumps({"type": "error", "code": "checkin_expired"}))
            await self.close(code=4003)
            return

        message = await self._create_message(text, media_key)
        if message is None:  # media_key supplied but invalid
            await self.send(text_data=json.dumps({"type": "error", "code": "media_invalid"}))
            return

        await self.channel_layer.group_send(
            self.group_name,
            {"type": "chat.message", "message": message},
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({"type": "message", "message": event["message"]}))

    async def media_ready(self, event):
        # Relay finished media (signed URLs already minted by the worker).
        await self.send(text_data=json.dumps({
            "type": "media_ready",
            "message_id": event["message_id"],
            "media": event["media"],
        }))

    # ── helpers ─────────────────────────────────────────────────────────────

    def _allow_send(self) -> bool:
        now = time.monotonic()
        while self._sends and now - self._sends[0] > SEND_WINDOW:
            self._sends.popleft()
        if len(self._sends) >= SEND_LIMIT:
            return False
        self._sends.append(now)
        return True

    @database_sync_to_async
    def _has_checkin(self, user, venue_id):
        from apps.checkins.models import CheckIn
        return CheckIn.objects.filter(
            user=user, venue_id=venue_id, expires_at__gt=timezone.now()
        ).exists()

    @database_sync_to_async
    def _get_venue(self, venue_id):
        from apps.venues.models import Venue
        return Venue.objects.get(id=venue_id)

    @database_sync_to_async
    def _create_message(self, text, media_key):
        """Create the message (+ optional media). Returns the broadcast dict, or
        None if a media_key was supplied but failed validation."""
        from apps.ratings import s3
        from apps.ratings.media_utils import media_type_for_key
        from .models import MessageMedia, VenueMessage
        from .tasks import process_message_media

        media_payload = None
        media_obj = None
        if media_key:
            media_obj = self._validate_media_key(media_key, s3, media_type_for_key)
            if media_obj is None:
                return None

        msg = VenueMessage.objects.create(
            venue=self.venue, user=self.user, text=text
        )
        if media_obj is not None:
            media = MessageMedia.objects.create(
                message=msg,
                media_type=media_obj["media_type"],
                status=MessageMedia.PROCESSING,
                original_key=media_key,
            )
            process_message_media.delay(str(media.id))
            media_payload = {
                "id": str(media.id),
                "media_type": media.media_type,
                "status": MessageMedia.PROCESSING,
                "file_url": None,
                "thumbnail_url": None,
                "width": None,
                "height": None,
                "duration_ms": None,
            }

        return {
            "id": str(msg.id),
            "user_id": self.user.id,
            "user_display_name": self.user.display_name or self.user.email,
            "text": msg.text,
            "created_at": msg.created_at.isoformat(),
            "media": media_payload,
        }

    def _validate_media_key(self, media_key, s3, media_type_for_key):
        """IDOR + type + size guard. Returns {'media_type': ...} or None."""
        if not isinstance(media_key, str):
            return None
        user_prefix = f"{s3.CHAT_UNCONFIRMED_PREFIX}/{self.user.id}/"
        if not media_key.startswith(user_prefix):
            return None
        media_type = media_type_for_key(media_key)
        if not media_type:
            return None
        max_bytes = (
            settings.MEDIA_MAX_IMAGE_BYTES
            if media_type == "image"
            else settings.MEDIA_CHAT_MAX_VIDEO_BYTES
        )
        size = s3.object_size(media_key)
        if size is None or size > max_bytes:
            return None
        return {"media_type": media_type}

    @database_sync_to_async
    def _get_history(self):
        from apps.ratings import s3
        from .models import MessageMedia, VenueMessage
        qs = (
            VenueMessage.objects.filter(
                venue=self.venue, expires_at__gt=timezone.now()
            )
            .select_related("user")
            .prefetch_related("media")
            .order_by("-created_at")[:50]
        )
        out = []
        for m in reversed(list(qs)):
            ready = next(
                (x for x in m.media.all() if x.status == MessageMedia.READY), None
            )
            media_payload = None
            if ready:
                media_payload = {
                    "id": str(ready.id),
                    "media_type": ready.media_type,
                    "status": MessageMedia.READY,
                    "file_url": s3.signed_cdn_url(ready.original_key),
                    "thumbnail_url": (
                        s3.signed_cdn_url(ready.thumbnail_key)
                        if ready.thumbnail_key else None
                    ),
                    "width": ready.width,
                    "height": ready.height,
                    "duration_ms": ready.duration_ms,
                }
            out.append({
                "id": str(m.id),
                "user_id": m.user.id,
                "user_display_name": m.user.display_name or m.user.email,
                "text": m.text,
                "created_at": m.created_at.isoformat(),
                "media": media_payload,
            })
        return out

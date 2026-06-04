from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<venue_id>[0-9a-f-]+)/$", consumers.VenueChatConsumer.as_asgi()),
]

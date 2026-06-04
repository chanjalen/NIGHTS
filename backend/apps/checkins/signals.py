from django.db.models import F
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import CheckIn


@receiver(post_save, sender=CheckIn)
def on_checkin_save(sender, instance, created, **kwargs):
    if created:
        instance.user.__class__.objects.filter(pk=instance.user_id).update(
            checkin_count=F("checkin_count") + 1
        )

from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

# Never run production on the insecure dev fallback key — sessions and signed
# tokens (incl. password-reset links) would be forgeable.
if not os.environ.get("SECRET_KEY"):
    raise ImproperlyConfigured("SECRET_KEY environment variable must be set in production.")

ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")

CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
CORS_ALLOW_CREDENTIALS = True

# Default "Lax" works when the frontend and API share a registrable domain
# (e.g. app.example.com + api.example.com). If they are truly cross-site, set
# these to "None" (Secure cookies are already enforced below) so the session
# cookie is sent on the SPA's credentialed fetches.
SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.environ.get("CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Send real email once SMTP credentials are present; otherwise fall back to the
# console backend so a misconfigured prod doesn't silently fail signups.
if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

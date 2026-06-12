from django.core.exceptions import ImproperlyConfigured

from .base import *

DEBUG = False

# Never run production on the insecure dev fallback key — sessions and signed
# tokens (incl. password-reset links) would be forgeable.
if not os.environ.get("SECRET_KEY"):
    raise ImproperlyConfigured("SECRET_KEY environment variable must be set in production.")

# Must include BOTH the API host (HTTP Host header) AND the frontend host: the
# chat websocket's AllowedHostsOriginValidator (config/asgi.py) checks the WS
# Origin — which is the frontend — against this list. e.g.
# "api.findyournights.com,findyournights.com,www.findyournights.com"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "").split(",")

# allauth builds verification / password-reset links with this scheme.
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "https"

# allauth's HTML flows (Google OAuth callback, the logout form POST) redirect
# here when finished. Without this they fall back to "/" on the API domain, which
# 404s — send them back to the frontend instead. Login lands on /signin, which
# bounces the now-authed user to the page they were on before signing in.
LOGIN_REDIRECT_URL = f"{FRONTEND_URL}/signin"
LOGOUT_REDIRECT_URL = FRONTEND_URL

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

# The SPA (www/apex) and the API live on different subdomains, so cookies must be
# scoped to the shared parent (e.g. ".findyournights.com") — otherwise the
# frontend can't read the csrftoken cookie the API sets, and the session cookie
# isn't shared. Left unset (None) in local dev, where everything is on localhost.
SESSION_COOKIE_DOMAIN = os.environ.get("SESSION_COOKIE_DOMAIN") or None
CSRF_COOKIE_DOMAIN = os.environ.get("CSRF_COOKIE_DOMAIN") or None

# Distinct cookie names per environment. Dev and prod share the
# .findyournights.com cookie domain, so without this the dev login would clobber
# the prod session cookie (same name) in one browser. Defaults match Django's, so
# prod is unchanged; .env.dev sets the *_dev variants. The frontend reads the CSRF
# cookie by name too (NEXT_PUBLIC_CSRF_COOKIE_NAME).
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "sessionid")
CSRF_COOKIE_NAME = os.environ.get("CSRF_COOKIE_NAME", "csrftoken")

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# Caddy already redirects http→https at the edge; this is defense in depth. Safe
# behind the proxy because SECURE_PROXY_SSL_HEADER lets Django see the real scheme
# (no redirect loop on Caddy→api internal http traffic).
SECURE_SSL_REDIRECT = True

# Send real email once SMTP credentials are present; otherwise fall back to the
# console backend so a misconfigured prod doesn't silently fail signups.
if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

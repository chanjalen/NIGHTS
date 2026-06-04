from .base import *

DEBUG = True

LOGIN_REDIRECT_URL = "http://localhost:3000"
LOGOUT_REDIRECT_URL = "http://localhost:3000"
ACCOUNT_DEFAULT_HTTP_PROTOCOL = "http"

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "api"]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
]

CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
CSRF_TRUSTED_ORIGINS = ["http://localhost:3000"]

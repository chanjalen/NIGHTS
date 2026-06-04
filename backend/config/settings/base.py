import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

DEBUG = False

ALLOWED_HOSTS = []

DJANGO_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "channels",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.cities",
    "apps.venues",
    "apps.ratings",
    "apps.checkins",
    "apps.chat",
    "apps.saved",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "config.context_processors.frontend_url",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "postgres"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", ""),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "OPTIONS": {"sslmode": "require"},
        "CONN_MAX_AGE": 0,
    }
}

# ── Security headers (applied by SecurityMiddleware to all API responses) ────
# Media itself is served by CloudFront, which needs its own response-headers
# policy for these (configured in the AWS console).
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
X_FRAME_OPTIONS = "DENY"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

SITE_ID = 1

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # Generous global backstops (reads stay fast); tight scoped limits are applied
    # per write/expensive endpoint via ScopedRateThrottle (see views).
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.AnonRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": "1000/min",
        "anon": "300/min",
        "media_presign": "30/min",
        "media_report": "20/min",
        "rating_write": "15/min",
        "venue_request": "10/min",
        "write": "60/min",
    },
}

# django-allauth
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = "email"
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "APP": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        },
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
    }
}

GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_LOGIN_ON_GET = True

ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [(os.environ.get("REDIS_HOST", "redis"), int(os.environ.get("REDIS_PORT", 6379)))],
        },
    },
}

# ── AWS S3 / media storage ──────────────────────────────────────────────────
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "")
AWS_S3_REGION = os.environ.get("AWS_S3_REGION", "us-east-1")
# Optional S3-compatible endpoint (e.g. MinIO) for local dev/testing.
AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", "")
# Public CDN host that fronts the bucket (CloudFront). Used to build media URLs.
AWS_CLOUDFRONT_DOMAIN = os.environ.get("AWS_CLOUDFRONT_DOMAIN", "")

# CloudFront signed URLs (private chat media). Empty in dev = falls back to
# unsigned CDN URLs so local/MinIO testing still works. The private key can be
# given inline (AWS_CLOUDFRONT_PRIVATE_KEY) or, preferably, as a mounted file
# path (AWS_CLOUDFRONT_PRIVATE_KEY_FILE) so the secret never lives in env.
AWS_CLOUDFRONT_KEY_PAIR_ID = os.environ.get("AWS_CLOUDFRONT_KEY_PAIR_ID", "")
AWS_CLOUDFRONT_PRIVATE_KEY = os.environ.get("AWS_CLOUDFRONT_PRIVATE_KEY", "")
AWS_CLOUDFRONT_PRIVATE_KEY_FILE = os.environ.get("AWS_CLOUDFRONT_PRIVATE_KEY_FILE", "")
MEDIA_SIGNED_URL_TTL = 60 * 60 * 2  # 2 hours

# Review media upload constraints (enforced when issuing presigned URLs).
MEDIA_MAX_FILES_PER_RATING = 6
MEDIA_MAX_IMAGE_BYTES = 10 * 1024 * 1024          # 10 MB
MEDIA_MAX_VIDEO_BYTES = 150 * 1024 * 1024         # 150 MB
MEDIA_MAX_VIDEO_SECONDS = 60

# Chat media: one item per message, tighter video limits.
MEDIA_CHAT_MAX_VIDEO_BYTES = 50 * 1024 * 1024     # 50 MB
MEDIA_CHAT_MAX_VIDEO_SECONDS = 30

MEDIA_ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/gif": "gif",
}
MEDIA_ALLOWED_VIDEO_TYPES = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
}

# ── Celery ──────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = os.environ.get(
    "CELERY_BROKER_URL",
    f"redis://{os.environ.get('REDIS_HOST', 'redis')}:{os.environ.get('REDIS_PORT', 6379)}/0",
)
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

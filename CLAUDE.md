# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NITE — a city-first bar and nightlife discovery platform ("Rate My Professors for nightlife"). Django REST Framework API backend + Next.js 14 frontend, PostgreSQL hosted on Supabase.

## Common Commands

All backend commands run inside Docker. The `.env` file in the project root is required.

```bash
# Build the API image
docker compose build api

# Run the dev server (hot-reload via volume mount)
docker compose up api

# Run both services
docker compose up

# Generate migrations after model changes
docker compose run --rm api python manage.py makemigrations accounts cities venues ratings checkins chat

# Apply migrations to Supabase
docker compose run --rm api python manage.py migrate

# Django shell
docker compose run --rm api python manage.py shell

# Create a superuser
docker compose run --rm api python manage.py createsuperuser
```

Frontend (Next.js):
```bash
docker compose up frontend
# or locally:
cd frontend && npm run dev
```

## Architecture

### Backend (`backend/`)

Django project with settings split across `config/settings/base.py` (shared), `local.py` (dev), and `production.py` (prod). `manage.py` defaults to `config.settings.local`; `wsgi.py` defaults to `config.settings.production`.

All API routes are prefixed `/api/v1/` and defined in `config/urls.py`. Auth routes use django-allauth's headless mode at `/api/v1/auth/`.

Six local apps under `backend/apps/`:

| App | Model | Key behavior |
|-----|-------|-------------|
| `accounts` | `User` (extends AbstractUser) | Adds `google_id`, `display_name`, `avatar_url`, `home_city`, `rating_count`, `checkin_count` |
| `cities` | `City` | UUID pk, slug, lat/lng, denormalized `venue_count` |
| `venues` | `Venue` | Requires `city` FK; `timezone` field (IANA string) drives chat expiry; `overall_rating`/`total_ratings` are denormalized, recomputed by signal |
| `ratings` | `Rating` | One per user per venue (`unique_together`); `day_of_week` is MON–SUN choice; `checkin_verified` set at creation time |
| `checkins` | `CheckIn` | `expires_at` auto-set to `now + 4h` in `save()`; `is_active` is a read-time property (no background job) |
| `chat` | `VenueMessage` | `expires_at` auto-set to next 6am in the venue's IANA timezone; read/write requires an active check-in |

### Signals

- `apps/ratings/signals.py` — `post_save` and `post_delete` on `Rating` → recomputes `venue.overall_rating` and `venue.total_ratings` via `Avg`/`Count` aggregates, saves with `update_fields`.
- `apps/checkins/signals.py` — `post_save` on `CheckIn` (created only) → increments `user.checkin_count` with `F()` expression.
- Both wired in their app's `AppConfig.ready()`.

### Auth

Google OAuth via `django-allauth`. `AUTH_USER_MODEL = "accounts.User"`. Frontend authenticates via HTTP-only session cookies (no JWT). CORS is configured for `localhost:3000` in local settings; `CSRF_TRUSTED_ORIGINS` must include the frontend URL in production.

### Database

PostgreSQL on Supabase via Session Pooler (IPv4 compatible). Connection uses individual env vars (`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`) — not a `DATABASE_URL` — because Supabase passwords can contain characters that break Python 3.11's URL parser. SSL is always required (`sslmode: require` in `OPTIONS`).

`django.contrib.postgres` is in `INSTALLED_APPS` for `ArrayField` used on `Venue.music_tags`, `Venue.crowd_tags`, `Rating.music_tags`, `Rating.crowd_tags`.

### Frontend (`frontend/`)

Next.js 14 App Router with TypeScript. Calls the Django API at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`). No pages implemented yet — structure is scaffolded only.

## Environment Variables

Copy `.env.example` to `.env` in the project root. Required vars:

- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` — Supabase Session Pooler connection parameters
- `SECRET_KEY` — Django secret key
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth app credentials
- `GOOGLE_PLACES_API_KEY` — for venue seeding and photo proxy

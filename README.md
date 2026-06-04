# NITE

A city-first bar & nightlife discovery platform — "Rate My Professors for nightlife."
Django REST Framework API + Next.js 14 frontend, PostgreSQL on Supabase, media on AWS S3 + CloudFront.

## Features

- **Cities & venues** — browse nightlife by city; venue pages with ratings, price, music/crowd vibes, check-ins.
- **Ratings** — one review per user per venue, with photos & videos (images → JPEG, video → H.264 MP4, async-processed).
- **Live venue chat** — real-time WebSocket chat per venue (check-in gated), ephemeral (resets at 6am local time), with media (signed/private CloudFront URLs).
- **Check-ins** — "I'm here now," expire after 4h.
- **Saved venues**, profile (reviews / visited / saved tabs), request-a-venue for empty cities.
- **Media pipeline** — direct-to-S3 presigned uploads, Celery workers, size/type limits, ffmpeg sandboxing, report + admin moderation.

## Stack

| Layer | Tech |
|---|---|
| Backend | Django 4.2, Django REST Framework, Channels (WebSockets), Celery |
| Frontend | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL (Supabase, Session Pooler) |
| Cache / broker | Redis |
| Media | AWS S3 + CloudFront (signed URLs for private chat media) |
| Auth | Google OAuth via django-allauth (HTTP-only session cookies) |

## Architecture

Backend apps (`backend/apps/`): `accounts`, `cities`, `venues`, `ratings`, `checkins`, `chat`, `saved`.
Shared media processing in `apps/media_processing.py`; S3/CloudFront helpers in `apps/ratings/s3.py`.
API is under `/api/v1/`; auth under `/api/v1/auth/` (allauth headless). WebSocket chat at `ws/chat/<venue_id>/`.

## Local setup

1. **Prereqs:** Docker + Docker Compose. (Frontend can also run locally with Node.)
2. **Env:** copy the example and fill in real values:
   ```bash
   cp .env.example .env
   ```
   You'll need a Supabase database, Google OAuth credentials, and (for media) an AWS S3 bucket + CloudFront distribution.
3. **Run the backend stack** (API + Celery worker + Redis):
   ```bash
   docker compose up api worker redis
   ```
4. **Run migrations:**
   ```bash
   docker compose exec api python manage.py migrate
   ```
5. **Frontend** — either in Docker (`docker compose up frontend`) or locally:
   ```bash
   cd frontend && npm install && npm run dev
   ```
   App: http://localhost:3000 · API: http://localhost:8000

## Common commands

```bash
# Migrations
docker compose exec api python manage.py makemigrations
docker compose exec api python manage.py migrate

# Django shell / superuser
docker compose exec api python manage.py shell
docker compose exec api python manage.py createsuperuser

# Seed venues from Google Places
docker compose exec api python manage.py seed_venues --lat 41.88 --lng -87.62 --radius 40

# Frontend typecheck
cd frontend && npx tsc --noEmit
```

## Media / AWS setup

Review media is public via CloudFront; chat media is private via **signed CloudFront URLs**.
See `docs/MEDIA_SETUP.md` for the one-time AWS setup (bucket, CloudFront, OAC, key group, lifecycle rules).

## Security notes

- Secrets live only in `.env` and `backend/secrets/` (both gitignored). **Never commit them.**
- Uploads are size/type-limited (enforced by S3 presigned-POST policies) and processed in sandboxed Celery workers.
- API write endpoints are rate-limited; media + chat support user reporting with a Django admin moderation queue.

## License

Proprietary — all rights reserved (update as needed).

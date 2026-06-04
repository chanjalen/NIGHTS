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


# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
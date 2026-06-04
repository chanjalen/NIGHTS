# NITE — Build Plan

## What We're Building
"Rate My Professors for nightlife" — a city-first bar/club discovery platform where users rate venues, check in, and chat with others currently at the same bar. Web app first, Django backend + Next.js frontend.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Backend | Django 4.2 + Django REST Framework |
| Frontend | Next.js App Router (separate Docker service) |
| Database | Supabase (hosted PostgreSQL 15) |
| Auth | django-allauth + Google OAuth → HTTP-only session cookies |
| Real-time (v1) | REST polling every 30s |
| Check-in expiry | On-read (no Celery — `is_active` property) |
| Chat expiry | Next 6am in venue's local timezone (`zoneinfo`) |
| Venue data | Google Places API (New) seeded via management command |
| Containerization | Docker Compose (`api` + `frontend` services, no local DB) |

---

## Data Models

### User (`apps/accounts`)
- Extends `AbstractUser`
- Extra: `google_id`, `display_name`, `avatar_url`, `home_city` FK, `rating_count`, `checkin_count`

### City (`apps/cities`)
- `id` UUID, `name`, `slug` (unique), `lat`, `lng`, `venue_count` (denormalized)

### Venue (`apps/venues`)
- UUID PK, FK to City
- `slug` unique per city (not globally), `address`, `neighborhood`, `lat`, `lng`
- `google_place_id`, `photo_url`, `timezone` (IANA string, e.g. "America/Chicago")
- `overall_rating`, `total_ratings` (denormalized via `post_save` signal on Rating)
- `price_level` 1–4 ($ to $$$$), `music_tags[]`, `crowd_tags[]`, `typical_cover`

### Rating (`apps/ratings`)
- UUID PK, FK to Venue + User, `unique_together = [("venue", "user")]`
- `overall` 1–5, `day_of_week` (MON–SUN), `price_level`, `music_tags[]`, `crowd_tags[]`
- `has_cover`, `cover_amount`, `would_go_back`, `comment` (280 chars)
- `checkin_verified` (auto-set at creation — checks for active CheckIn)
- Signal: `post_save` + `post_delete` → recompute `venue.overall_rating` + `total_ratings`

### CheckIn (`apps/checkins`)
- UUID PK, FK to Venue + User
- `expires_at` = `created_at + 4 hours` (set in `save()`)
- `is_active` property — no background job needed
- Signal: `post_save` → `user.checkin_count += 1`

### VenueMessage (`apps/chat`)
- UUID PK, FK to Venue + User
- `text` (280 chars), `expires_at` = next 6am in `venue.timezone`
- `is_active` property
- Access requires active CheckIn for that venue (enforced in view permission)

---

## API Endpoints

```
GET  /api/v1/cities/
GET  /api/v1/cities/<slug>/
GET  /api/v1/venues/?city=<slug>&neighborhood=&search=&music_tag=&crowd_tag=
GET  /api/v1/venues/<uuid>/
GET  /api/v1/ratings/?venue=<uuid>
POST /api/v1/ratings/              (auth required)
GET  /api/v1/checkins/?venue=<uuid>
POST /api/v1/checkins/             (auth required)
GET  /api/v1/chat/?venue=<uuid>    (active check-in required)
POST /api/v1/chat/                 (active check-in required)
GET  /api/v1/accounts/me/          (auth required)
POST/api/v1/auth/...               (allauth headless Google OAuth)
```

---

## Key Design Decisions

1. **Frontend**: Next.js App Router (SSR keeps Google indexing; separate Docker service)
2. **Auth flow**: Django handles Google OAuth → sets HTTP-only session cookie → Next.js sends it on every request automatically
3. **Check-in expiry**: On-read only. `expires_at` stored in DB, filtered at query time. No Celery.
4. **Chat expiry**: `_next_6am(tz_name)` computed at message creation. Venue has `timezone` field (IANA string).
5. **Venue detail URL**: Uses UUID (`/api/v1/venues/<uuid>/`), not slug — slugs are only unique per-city.
6. **Active check-in count**: Annotated via `Count("checkins", filter=Q(...))` — single query, no N+1.
7. **Supabase connection**: Session Pooler (not Direct) — IPv4 compatible. Individual DB env vars, not DATABASE_URL (Python 3.11 urlsplit bug with special chars in passwords).

---

## Implementation Phases

### Phase 1 — Foundation (Done ✓)
- [x] Docker Compose: `api` (Django) + `frontend` (Next.js), Supabase DB
- [x] Django project scaffold with `config/settings/`
- [x] All models + migrations
- [x] Serializers + views for all 6 apps
- [x] Google Places seeder management command

### Phase 2 — Auth + Core Interaction
- [ ] Google OAuth via django-allauth (headless mode)
- [ ] Next.js frontend: city list page, venue list page, venue detail page
- [ ] Rating form (POST to `/api/v1/ratings/`)
- [ ] Check-in button (POST to `/api/v1/checkins/`)
- [ ] SEO meta tags

### Phase 3 — Check-ins + Chat
- [ ] Active check-in count polling (30s interval on venue detail page)
- [ ] Venue chat (requires active check-in, messages expire at 6am)
- [ ] Verified check-in badge on ratings
- [ ] User profile page

### Phase 4 — Polish + Launch
- [ ] Add-venue form (Google Places autocomplete)
- [ ] Venue photo proxy view (`GET /api/v1/venues/<pk>/photo/`)
- [ ] Error pages (404, 500)
- [ ] Posthog JS integration
- [ ] Docker production config (Nginx + Gunicorn)
- [ ] Mobile polish + accessibility pass

---

## Google Places Seeder

### Run command
```bash
# Chicago (run now — uses May free cap)
docker compose run --rm api python manage.py seed_venues \
  --lat 41.8827 --lng -87.6233 --radius 40 --timezone America/Chicago

# NYC (run June 1 — uses June free cap)
docker compose run --rm api python manage.py seed_venues \
  --lat 40.7128 --lng -74.0060 --radius 30 --timezone America/New_York

# Bay Area (run June 1 — same June cap)
docker compose run --rm api python manage.py seed_venues \
  --lat 37.7749 --lng -122.4194 --radius 30 --timezone America/Los_Angeles
```

### Flags
- `--dry-run` — preview counts by city, no DB writes
- `--resume` — skip place_ids already in DB (safe to re-run)
- `--api-key KEY` — override `GOOGLE_PLACES_API_KEY` env var

### Cost estimate (New Places API, March 2025 pricing)
| City | Approx venues | Estimated cost |
|------|--------------|----------------|
| Chicagoland (40mi) | 2,000–3,000 | ~$8–12 |
| NYC Metro (30mi) | 3,000–5,000 | ~$10–15 |
| Bay Area (30mi) | 1,500–2,500 | ~$6–10 |

All well within the 10,000/month free Essentials cap — Chicago tonight for free, NYC + Bay Area on June 1 for free.

---

## PRD Gap Analysis (Open Questions)

### Resolved
- ✓ Check-in expiry: on-read (no Supabase Edge Function needed)
- ✓ Real-time: polling (no Supabase Realtime needed)
- ✓ Chat expiry: 6am local venue timezone
- ✓ Day of visit: `day_of_week` field on Rating
- ✓ Price level: 1–4 matching Google Places ($ to $$$$)

### Still Open
- **Music/crowd tag values**: What predefined values? (e.g., Hip-Hop, EDM, House, Latin / Rowdy, Chill, Mixed, College)
- **Venue images**: Photo proxy view planned (`/api/v1/venues/<pk>/photo/`) — not yet built
- **Pagination**: Infinite scroll vs. numbered? How many per page?
- **Add-venue moderation**: Auto-approve or manual review?
- **Spam/flag system**: No flagging UI defined yet

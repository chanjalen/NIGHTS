# Deploying NITE to findyournights.com

Two isolated environments on one AWS Lightsail box (backend) + Vercel (frontend),
each with its own Supabase database.

| | URL | Backend | Database | Media bucket |
|---|---|---|---|---|
| **Prod** | `findyournights.com` | `api.findyournights.com` | Supabase `nite-prod` | `findyournights-media-prod` |
| **Dev** | `dev.findyournights.com` | `api-dev.findyournights.com` | Supabase `nite-dev` | `findyournights-media-dev` |

Backend topology (single Lightsail host):

```
Caddy (TLS, :80/:443)
 ├─ api      (daphne/ASGI)  ─┐                 ├─ redis      ── prod chat + celery
 ├─ worker   (celery+ffmpeg) ┘ → nite-prod     │
 ├─ api-dev  (daphne/ASGI)  ─┐                 ├─ redis-dev  ── dev chat + celery
 └─ worker-dev (celery)      ┘ → nite-dev
```

---

## 1. One-time infrastructure setup

### Supabase (×2)
1. Create projects `nite-prod` and `nite-dev` (strong DB passwords).
2. From each: **Connect → Session Pooler** → copy `DB_USER` (`postgres.<ref>`),
   `DB_HOST`, `DB_PORT`. These go in `.env.prod` / `.env.dev`.
3. (Optional) Restrict each project's network access to the Lightsail static IP.

### AWS
1. **S3**: create two buckets — `findyournights-media-prod`, `findyournights-media-dev`
   (keep them private; access via CloudFront only).
2. **CloudFront**: a distribution per bucket; reuse the existing response-headers
   policy. Note each distribution's domain + a key-group/key-pair for signed URLs.
3. **Lightsail**: Ubuntu LTS, **4 GB** plan. Attach a **static IP**. Attach an **IAM
   role** granting least-privilege access (GetObject/PutObject) to both media buckets
   so the backend needs no static AWS keys.
4. **SES** (email): verify the `findyournights.com` domain, add SPF/DKIM/DMARC DNS
   records, create SMTP credentials, and request **production access** (sandbox only
   sends to verified addresses) — start this early, approval takes time.

### Google OAuth (Google Cloud console)
Add authorized redirect URIs:
- `https://api.findyournights.com/accounts/google/login/callback/`
- `https://api-dev.findyournights.com/accounts/google/login/callback/`

### DNS
| Record | Type | Target |
|---|---|---|
| `findyournights.com`, `www` | per Vercel | Vercel |
| `dev` | per Vercel | Vercel (develop branch) |
| `api` | A | Lightsail static IP |
| `api-dev` | A | Lightsail static IP |

---

## 2. Provision the Lightsail box

```bash
# Install Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # re-login after this

# Firewall: only SSH + HTTP(S). (Also set the same in Lightsail networking tab.)
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable

# SSH hardening: key-only auth (in /etc/ssh/sshd_config set PasswordAuthentication no)
```

```bash
git clone <repo> nite && cd nite

# Secrets — never committed:
cp .env.prod .env.prod   && chmod 600 .env.prod   # fill in real values
cp .env.dev  .env.dev    && chmod 600 .env.dev
mkdir -p backend/secrets
#  → place CloudFront signing key at backend/secrets/cf_private_key.pem (chmod 600)

# Generate a unique SECRET_KEY for each env:
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

## 3. Bring up the backend

```bash
docker compose -f docker-compose.prod.yml up -d
# Services run prebuilt GHCR images (CI builds them; the box only pulls, never
# builds). api/api-dev run migrations automatically on start (RUN_MIGRATIONS=1).
# Requires .env.prod, .env.dev AND .env.caddy present + chmod 600 — compose
# references all three, so a missing file fails EVERY compose command on the box,
# including CI auto-deploys. Create .env.caddy before main first gets the compose.

# Seed reference data + admin user, per environment:
docker compose -f docker-compose.prod.yml exec api      python manage.py seed_cities
docker compose -f docker-compose.prod.yml exec api      python manage.py seed_venues
docker compose -f docker-compose.prod.yml exec api      python manage.py createsuperuser
docker compose -f docker-compose.prod.yml exec api-dev  python manage.py seed_cities
docker compose -f docker-compose.prod.yml exec api-dev  python manage.py seed_venues
docker compose -f docker-compose.prod.yml exec api-dev  python manage.py createsuperuser

# Caddy issues TLS certs for all four hostnames automatically once DNS resolves.
docker compose -f docker-compose.prod.yml logs -f caddy
```

**Redeploy after a code change:** push to git — CI does the rest.
`.github/workflows/deploy-backend.yml` builds the backend image, pushes it to GHCR,
and rolls the matching stack over SSH. Push to **`develop`** → `api-dev`/`worker-dev`;
push to **`main`** → `api`/`worker`. The box only pulls images (it no longer builds).

Manual roll on the box (rarely needed): `docker compose -f docker-compose.prod.yml pull api worker && docker compose -f docker-compose.prod.yml up -d api worker`
Rollback to an earlier build: `PROD_TAG=sha-<commit> docker compose -f docker-compose.prod.yml up -d api worker`

**Infra changes (Caddyfile / docker-compose.prod.yml) must land on `main`** — the box
pulls those two files from `main`. The deploy step `git pull origin main`s before
rolling. Caddy is NOT auto-rolled by CI; after a Caddyfile change, recreate it by
hand: `docker compose -f docker-compose.prod.yml up -d --force-recreate caddy`.

### Branch workflow
`main` = prod, `develop` = dev. Never push straight to `main`.
`feature → merge to develop (auto-deploys dev) → merge develop to main (auto-deploys prod)`.
Backend deploys only fire on changes under `backend/**` / `docker-compose.prod.yml`
/ the workflow file (a no-op push won't deploy — use **Actions → Run workflow**).

---

## 4. Configure Vercel (frontend)

1. Import the repo; root directory `frontend/`.
2. Environment variables — scope each to the right environment:
   - **Production** scope: `NEXT_PUBLIC_API_URL` + `API_URL` = `https://api.findyournights.com`;
     `NEXT_PUBLIC_WS_URL` = `wss://api.findyournights.com`.
   - **Preview → branch `develop`** scope: the `https://api-dev.*` / `wss://api-dev.*`
     values, **plus** `DEV_PROXY_SECRET` (must equal `.env.caddy`'s value — lets Vercel
     SSR through the api-dev gate) and `NEXT_PUBLIC_CSRF_COOKIE_NAME=csrftoken_dev`.
   - ⚠️ Never use the **"Production and Preview"** combined scope for the URL vars —
     it forces one value onto both envs. One Production row + one Preview/develop row.
   - Keep the URL vars **not Sensitive** so you can eyeball them (Sensitive hides the value).
3. Domains: `findyournights.com` + `www` → production; `dev.findyournights.com` →
   **bind to the `develop` branch** (Settings → Domains → the domain → Git Branch =
   `develop`). A domain with no branch binding serves **production** — a common trap.
4. **Deployment Protection** → Vercel Authentication → **Standard Protection**
   ("Only Preview Deployments") so `dev.findyournights.com` sits behind a login wall;
   leave **Production excluded** so the public site stays open.

> **`NEXT_PUBLIC_*` are inlined at BUILD time.** Changing the value in the dashboard
> does nothing until a *fresh* build runs — and a plain "Redeploy" REUSES the build
> cache, serving the old baked-in value. To pick up a changed `NEXT_PUBLIC_*`: Redeploy
> with **"Use existing Build Cache" UNCHECKED** (or push a commit / Clear Build Cache).
> Verify on the deployment's own `*.vercel.app` URL (rules out domain/edge cache).

---

## 4b. Dev environment privacy (api-dev access gate)

`dev.findyournights.com` is gated two ways so strangers see nothing:
- **Frontend:** Vercel Deployment Protection (login wall, §4.4).
- **Backend (`api-dev`):** a Caddy rule (see `Caddyfile`) that 403s unless the request
  is from an allowlisted IP **or** carries the `X-Dev-Proxy-Secret` header. The secret
  + allowed IP live in **`.env.caddy`** (gitignored, chmod 600) and are injected into
  the caddy container; the Caddyfile only references `{$DEV_PROXY_SECRET}`/`{$DEV_ALLOW_IP}`.

`.env.caddy`:
```
DEV_ALLOW_IP=<your PUBLIC IPv4>/32      # curl -4 ifconfig.me — NOT a 10.x/192.168 LAN IP
DEV_PROXY_SECRET=<openssl rand -base64 32>   # same value as Vercel's DEV_PROXY_SECRET
```
Who gets through: **you** (allowlisted IP → browser + direct API), **Vercel SSR**
(secret header), everyone else → 403. Browser client-side calls rely on the IP rule,
so **when your home IP changes, edit `DEV_ALLOW_IP` and** `up -d --force-recreate caddy`.
`api-dev.findyournights.com` is IPv4-only (A record), so allowlist your IPv4.

`.env.dev` must also carry the dev frontend origin (CORS/CSRF/host/redirect) and the
per-env cookie names so dev & prod sessions don't collide under the shared
`.findyournights.com` cookie domain:
```
ALLOWED_HOSTS=api-dev.findyournights.com,dev.findyournights.com
CORS_ALLOWED_ORIGINS=https://dev.findyournights.com
CSRF_TRUSTED_ORIGINS=https://dev.findyournights.com
FRONTEND_URL=https://dev.findyournights.com
SESSION_COOKIE_DOMAIN=.findyournights.com
CSRF_COOKIE_DOMAIN=.findyournights.com
SESSION_COOKIE_NAME=sessionid_dev
CSRF_COOKIE_NAME=csrftoken_dev
```
After editing `.env.dev`, apply it: `docker compose -f docker-compose.prod.yml up -d --force-recreate api-dev worker-dev`.

Quick gate test: `curl -i -H "Origin: https://dev.findyournights.com" -H "X-Dev-Proxy-Secret: $(grep '^DEV_PROXY_SECRET=' .env.caddy | cut -d= -f2-)" https://api-dev.findyournights.com/api/v1/cities/` → 200 + `Access-Control-Allow-Origin`. (Use `cut -d= -f2-`, not `-f2` — the base64 secret ends in `=`.)

---

## 5. Security checklist (verify before sharing the URL)

- [ ] Lightsail firewall + ufw: only 22/80/443 open; api & redis never published.
- [ ] SSH key-only (password auth disabled).
- [ ] HTTPS on all four hosts; HSTS header present (set in `production.py`).
- [ ] Unique strong `SECRET_KEY` per env; `DEBUG=False` (production default).
- [ ] `ALLOWED_HOSTS` / CORS / CSRF locked to exact hosts (no wildcards), incl. the
      frontend host in `ALLOWED_HOSTS` (websocket origin check).
- [ ] No static AWS keys in `.env*` (using the instance IAM role).
- [ ] `.env.prod` / `.env.dev` chmod 600; `secrets/` key chmod 600; both gitignored.
- [ ] Strong superuser password; consider Caddy IP-allowlisting `/admin/`.
- [ ] (Optional) bump `Django==4.2.11` to the latest 4.2.x patch; set Redis `requirepass`.

---

## 6. End-to-end verification

- `curl -I https://api.findyournights.com/api/v1/cities/` → `200` over valid TLS.
- `https://findyournights.com` loads cities/venues (SSR fetch works).
- **Auth:** sign up with a real email → verification email arrives → verify → log in.
- **Google OAuth** completes via the prod callback.
- **Chat:** with an active check-in, a venue chat connects over `wss://api.findyournights.com`
  and messages send (confirms the ALLOWED_HOSTS origin fix).
- **Media:** upload a review photo/video → renders via CloudFront; `docker compose ...
  logs worker` shows the transcode.
- **Isolation:** an action on `dev.findyournights.com` appears only in `nite-dev`.
- **Security smoke:** generic 404 (DEBUG off), HSTS header present, CORS rejects an
  unknown Origin, `/admin/` requires login.

### Dev environment checks
- On `dev.findyournights.com`, the "Continue with Google" link points to
  `api-dev.findyournights.com` (if it shows `api.*`, the build baked the prod URL —
  see the build-cache note in §4).
- DevTools → Network: app calls go to `api-dev.*` with no CORS error.
- From a non-allowlisted IP with no secret: `api-dev` → **403**, and the frontend
  shows the Vercel login wall.
- `dev.findyournights.com/robots.txt` → `Disallow: /` (noindex on preview);
  prod's → `Allow: /`. View-source on dev shows `<meta name="robots" content="noindex">`.
- Log into dev and prod in the same browser → both stay logged in (distinct
  `sessionid_dev`/`sessionid` cookies).

---

## Deferred (later)

- Mobile token auth via allauth headless **app client**.
- Sentry error monitoring, uptime checks, Supabase backup policy.

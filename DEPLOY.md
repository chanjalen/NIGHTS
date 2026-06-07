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
docker compose -f docker-compose.prod.yml up -d --build
# api / api-dev run migrations automatically on start (RUN_MIGRATIONS=1).

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

---

## 4. Configure Vercel (frontend)

1. Import the repo; root directory `frontend/`.
2. Environment variables:
   - **Production** (apex domain): `NEXT_PUBLIC_API_URL` + `API_URL` =
     `https://api.findyournights.com`; `NEXT_PUBLIC_WS_URL` = `wss://api.findyournights.com`.
   - **Dev branch** (`dev.findyournights.com`): the `api-dev.*` / `wss://api-dev.*` values.
3. Domains: `findyournights.com` + `www` → production; `dev.findyournights.com` →
   the `develop` branch.

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

---

## Deferred (later)

- Mobile token auth via allauth headless **app client**.
- Sentry error monitoring, uptime checks, Supabase backup policy.

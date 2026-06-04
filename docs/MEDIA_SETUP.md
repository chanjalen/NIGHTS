# Review Media (Photos & Videos) — AWS Setup

Reviews can attach up to **6** photos/videos. Files upload **directly to S3** via
presigned URLs; a **Celery worker** normalizes images and transcodes videos to
H.264 MP4; media is served through **CloudFront**. The app builds and runs without
any of this configured — only the *upload/view* actions need AWS.

## One-time AWS setup

1. **S3 bucket** (e.g. `nite-review-media`)
   - Region: pick one (e.g. `us-east-1`).
   - **Block all public access: ON** (the bucket stays private; CloudFront serves reads).

2. **CloudFront distribution**
   - Origin = the bucket, using **Origin Access Control (OAC)** so CloudFront can read
     the private bucket. Apply the generated bucket policy.
   - Note the distribution domain (e.g. `d111111abcdef8.cloudfront.net`) → `AWS_CLOUDFRONT_DOMAIN`.

3. **S3 lifecycle rule**
   - Prefix `unconfirmed/` → **expire objects after 1 day** (cleans up uploads that
     were never attached to a review).

4. **CORS** on the bucket (so the browser can PUT directly). Allow `PUT` from the
   frontend origin:
   ```json
   [
     {
       "AllowedMethods": ["PUT"],
       "AllowedOrigins": ["http://localhost:3000", "https://YOUR_PROD_DOMAIN"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

5. **IAM user** (programmatic, least privilege). Attach a policy scoped to the bucket:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
       "Resource": [
         "arn:aws:s3:::nite-review-media",
         "arn:aws:s3:::nite-review-media/*"
       ]
     }]
   }
   ```
   Create an access key for this user.

## Environment variables

Add to `.env` (consumed by both the `api` and `worker` services):

```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=nite-review-media
AWS_S3_REGION=us-east-1
AWS_CLOUDFRONT_DOMAIN=d111111abcdef8.cloudfront.net
# optional — defaults to redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
```

## Running

```bash
docker compose up api worker frontend   # worker runs the media pipeline
```

## Limits (configurable in config/settings/base.py)
- `MEDIA_MAX_FILES_PER_RATING = 6`
- `MEDIA_MAX_IMAGE_BYTES = 10MB`, `MEDIA_MAX_VIDEO_BYTES = 150MB`
- `MEDIA_MAX_VIDEO_SECONDS = 60` (videos are clamped to this on transcode)
- Allowed: images jpg/png/webp/heic; video mp4/mov (output is always H.264 MP4 + JPEG thumbnail)

## Moderation
No automated filtering. Users can **report** media (`POST /api/v1/ratings/media/<id>/report/`);
reports appear in the **Django admin** (`RatingMedia` + `MediaReport`) where staff can
**remove** media (hides it and deletes the S3 objects). To add automated screening later,
drop it into `apps/ratings/tasks.py::process_media` — no API changes needed.

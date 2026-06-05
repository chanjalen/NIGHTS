#!/bin/sh
set -e

# Apply DB migrations once on startup. Only the api container sets
# RUN_MIGRATIONS=1; the worker leaves it unset so the two don't race to migrate.
if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "Applying database migrations..."
  python manage.py migrate --noinput
fi

exec "$@"

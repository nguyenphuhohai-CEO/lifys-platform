#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/etc/lifys/server.env}"
MODE="${2:-issue}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${APP_DIR:?APP_DIR is required}"
: "${APP_DOMAIN:?APP_DOMAIN is required}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL is required}"
: "${COMPOSE_FILE:=docker-compose.public.yml}"

cd "$APP_DIR"

mkdir -p deploy/certs deploy/acme deploy/letsencrypt

if [ ! -f deploy/certs/fullchain.pem ] || [ ! -f deploy/certs/privkey.pem ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout deploy/certs/privkey.pem \
    -out deploy/certs/fullchain.pem \
    -subj "/CN=${APP_DOMAIN}"
fi

docker compose -f "$COMPOSE_FILE" up -d postgres app nginx

docker run --rm \
  -v "$APP_DIR/deploy/letsencrypt:/etc/letsencrypt" \
  -v "$APP_DIR/deploy/acme:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d "$APP_DOMAIN" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  $( [ "$MODE" = "--renew" ] && printf '%s' "--keep-until-expiring" || printf '%s' "--force-renewal" )

cp "deploy/letsencrypt/live/${APP_DOMAIN}/fullchain.pem" deploy/certs/fullchain.pem
cp "deploy/letsencrypt/live/${APP_DOMAIN}/privkey.pem" deploy/certs/privkey.pem

docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload


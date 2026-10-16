#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/etc/lifys/server.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${APP_DIR:?APP_DIR is required}"
: "${APP_USER:?APP_USER is required}"
: "${APP_BRANCH:=main}"
: "${REPO_REMOTE:?REPO_REMOTE is required}"
: "${COMPOSE_FILE:=docker-compose.public.yml}"

if [ ! -d "$APP_DIR/.git" ]; then
  install -d -o "$APP_USER" -g "${APP_GROUP:-$APP_USER}" "$APP_DIR"
  sudo -u "$APP_USER" git -C "$APP_DIR" init
  sudo -u "$APP_USER" git -C "$APP_DIR" remote add origin "$REPO_REMOTE"
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$APP_BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout -B "$APP_BRANCH" "origin/$APP_BRANCH"
else
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$APP_BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$APP_BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only origin "$APP_BRANCH"
fi

install -d -o "$APP_USER" -g "${APP_GROUP:-$APP_USER}" "$APP_DIR/backups"
install -d -o "$APP_USER" -g "${APP_GROUP:-$APP_USER}" "$APP_DIR/deploy/acme"
install -d -o "$APP_USER" -g "${APP_GROUP:-$APP_USER}" "$APP_DIR/deploy/certs"
install -d -o "$APP_USER" -g "${APP_GROUP:-$APP_USER}" "$APP_DIR/deploy/letsencrypt"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Missing $APP_DIR/.env. Create it from .env.production.example first." >&2
  exit 1
fi

cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" up -d --build
docker compose -f "$COMPOSE_FILE" ps

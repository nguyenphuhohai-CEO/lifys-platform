#!/usr/bin/env bash
set -euo pipefail

SERVER_ENV_PATH="/etc/lifys/server.env"
APP_ENV_PATH=""
APP_DIR="/opt/lifys-platform"
APP_USER="lifys"
APP_GROUP="lifys"
APP_BRANCH="main"
REPO_REMOTE="https://github.com/nguyenphuhohai-CEO/lifys-platform.git"
COMPOSE_FILE="docker-compose.public.yml"
SSH_PORT="22"
FORCE=0

APP_DOMAIN=""
LETSENCRYPT_EMAIL=""
RESEND_API_KEY=""
EMAIL_FROM=""

usage() {
  cat <<'EOF'
Usage:
  prepare-domain-config.sh \
    --domain lifys.example \
    --email ops@lifys.example \
    --resend-key re_xxx \
    [--email-from noreply@lifys.example] \
    [--app-dir /opt/lifys-platform] \
    [--server-env /etc/lifys/server.env] \
    [--app-env /opt/lifys-platform/.env] \
    [--app-user lifys] \
    [--app-group lifys] \
    [--branch main] \
    [--repo-remote https://github.com/nguyenphuhohai-CEO/lifys-platform.git] \
    [--ssh-port 22] \
    [--force]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --domain) APP_DOMAIN="${2:-}"; shift 2 ;;
    --email) LETSENCRYPT_EMAIL="${2:-}"; shift 2 ;;
    --resend-key) RESEND_API_KEY="${2:-}"; shift 2 ;;
    --email-from) EMAIL_FROM="${2:-}"; shift 2 ;;
    --app-dir) APP_DIR="${2:-}"; shift 2 ;;
    --server-env) SERVER_ENV_PATH="${2:-}"; shift 2 ;;
    --app-env) APP_ENV_PATH="${2:-}"; shift 2 ;;
    --app-user) APP_USER="${2:-}"; shift 2 ;;
    --app-group) APP_GROUP="${2:-}"; shift 2 ;;
    --branch) APP_BRANCH="${2:-}"; shift 2 ;;
    --repo-remote) REPO_REMOTE="${2:-}"; shift 2 ;;
    --ssh-port) SSH_PORT="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ -z "$APP_DOMAIN" ] || [ -z "$LETSENCRYPT_EMAIL" ] || [ -z "$RESEND_API_KEY" ]; then
  echo "--domain, --email and --resend-key are required." >&2
  usage >&2
  exit 1
fi

if [ -z "$APP_ENV_PATH" ]; then
  APP_ENV_PATH="${APP_DIR}/.env"
fi

if ! printf '%s' "$APP_DOMAIN" | grep -Eq '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'; then
  echo "Invalid domain: $APP_DOMAIN" >&2
  exit 1
fi

if ! printf '%s' "$LETSENCRYPT_EMAIL" | grep -Eq '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'; then
  echo "Invalid email: $LETSENCRYPT_EMAIL" >&2
  exit 1
fi

if [ -z "$EMAIL_FROM" ]; then
  EMAIL_FROM="noreply@${APP_DOMAIN}"
fi

if [ -e "$SERVER_ENV_PATH" ] && [ "$FORCE" -ne 1 ]; then
  echo "Refusing to overwrite existing file: $SERVER_ENV_PATH (use --force)" >&2
  exit 1
fi

if [ -e "$APP_ENV_PATH" ] && [ "$FORCE" -ne 1 ]; then
  echo "Refusing to overwrite existing file: $APP_ENV_PATH (use --force)" >&2
  exit 1
fi

JWT_SECRET="$(openssl rand -hex 48)"
POSTGRES_PASSWORD="$(openssl rand -base64 36 | tr -d '\n' | tr '/+' 'ab' | cut -c1-40)"

install -d -m 0755 "$(dirname "$SERVER_ENV_PATH")"
install -d -m 0755 "$(dirname "$APP_ENV_PATH")"

cat >"$SERVER_ENV_PATH" <<EOF
APP_DIR=${APP_DIR}
APP_USER=${APP_USER}
APP_GROUP=${APP_GROUP}
APP_DOMAIN=${APP_DOMAIN}
APP_BRANCH=${APP_BRANCH}
REPO_REMOTE=${REPO_REMOTE}
COMPOSE_FILE=${COMPOSE_FILE}
SSH_PORT=${SSH_PORT}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}
EOF

cat >"$APP_ENV_PATH" <<EOF
APP_DOMAIN=${APP_DOMAIN}
PORT=3001
APP_BASE_URL=https://${APP_DOMAIN}
VITE_API_BASE_URL=
DATABASE_PROVIDER=postgres
DATABASE_URL=postgres://lifys:${POSTGRES_PASSWORD}@postgres:5432/lifys
DATABASE_SSL=false
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECTION_TIMEOUT_MS=10000
DATABASE_FILE=/var/lib/lifys/lifys.sqlite
ALLOW_SQLITE_IN_PRODUCTION=false
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=15m
REFRESH_COOKIE_NAME=lifys_refresh_token
CSRF_COOKIE_NAME=lifys_csrf_token
VITE_CSRF_COOKIE_NAME=lifys_csrf_token
EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=${RESEND_API_KEY}
EMAIL_FROM=${EMAIL_FROM}
REFRESH_TOKEN_TTL_DAYS=30
EMAIL_VERIFICATION_TOKEN_TTL_HOURS=24
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
COOKIE_SECURE=true
CORS_ORIGIN=https://${APP_DOMAIN}
RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=10
WRITE_RATE_LIMIT_MAX=60
DEMO_DISCOVERY_ENABLED=false
LOG_LEVEL=info
LOG_REQUESTS=true
TRUST_PROXY=true
FORCE_HTTPS=true
STATIC_ASSET_MAX_AGE_SECONDS=86400
TLS_CERT_PATH=/etc/nginx/certs/fullchain.pem
TLS_KEY_PATH=/etc/nginx/certs/privkey.pem
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF

echo "Created:"
echo "  - ${SERVER_ENV_PATH}"
echo "  - ${APP_ENV_PATH}"
echo
echo "Next steps:"
echo "  1. sudo bash deploy/ubuntu-24.04/setup-vps.sh ${SERVER_ENV_PATH}"
echo "  2. sudo bash deploy/ubuntu-24.04/deploy.sh ${SERVER_ENV_PATH}"
echo "  3. sudo bash ${APP_DIR}/deploy/ubuntu-24.04/bootstrap-tls.sh ${SERVER_ENV_PATH}"
echo "  4. sudo bash ${APP_DIR}/deploy/ubuntu-24.04/install-systemd-jobs.sh ${SERVER_ENV_PATH}"


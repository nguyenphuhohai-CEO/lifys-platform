#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/etc/lifys/server.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${APP_DIR:?APP_DIR is required}"
: "${APP_USER:?APP_USER is required}"
: "${APP_GROUP:=lifys}"
: "${SSH_PORT:=22}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades openssl

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if ! getent group "$APP_GROUP" >/dev/null; then
  groupadd --system "$APP_GROUP"
fi

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --gid "$APP_GROUP" --shell /bin/bash "$APP_USER"
fi

usermod -aG docker "$APP_USER"

install -d -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/backups"
install -d -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/deploy/acme"
install -d -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/deploy/certs"
install -d -o "$APP_USER" -g "$APP_GROUP" "$APP_DIR/deploy/letsencrypt"
install -d -o root -g root /etc/lifys

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow "${SSH_PORT}/tcp"
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

systemctl enable --now docker
systemctl enable --now fail2ban
systemctl enable --now unattended-upgrades

echo "Server bootstrap complete."
echo "Next steps:"
echo "1. If needed, generate ${ENV_FILE} and ${APP_DIR}/.env with deploy/ubuntu-24.04/prepare-domain-config.sh"
echo "2. Copy the repository to ${APP_DIR} or run deploy/ubuntu-24.04/deploy.sh"
echo "3. Run deploy/ubuntu-24.04/bootstrap-tls.sh ${ENV_FILE}"
echo "4. Run deploy/ubuntu-24.04/install-systemd-jobs.sh ${ENV_FILE}"

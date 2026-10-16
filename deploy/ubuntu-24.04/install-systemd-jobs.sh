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
: "${COMPOSE_FILE:=docker-compose.public.yml}"

cat >/etc/systemd/system/lifys-backup.service <<EOF
[Unit]
Description=Lifys PostgreSQL backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/docker compose -f ${COMPOSE_FILE} run --rm backup
EOF

cat >/etc/systemd/system/lifys-backup.timer <<'EOF'
[Unit]
Description=Run Lifys backup daily

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat >/etc/systemd/system/lifys-cert-renew.service <<EOF
[Unit]
Description=Renew Lifys TLS certificate
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash ${APP_DIR}/deploy/ubuntu-24.04/bootstrap-tls.sh ${ENV_FILE} --renew
EOF

cat >/etc/systemd/system/lifys-cert-renew.timer <<'EOF'
[Unit]
Description=Renew Lifys TLS certificate daily

[Timer]
OnCalendar=*-*-* 02:45:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now lifys-backup.timer
systemctl enable --now lifys-cert-renew.timer

echo "Installed timers:"
systemctl list-timers lifys-backup.timer lifys-cert-renew.timer --no-pager


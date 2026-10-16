# Cible exacte : VPS Ubuntu 24.04 LTS (Hetzner / OVH)

Cette variante prépare une cible unique explicite :

- **1 VPS Ubuntu 24.04 LTS**
- **4 vCPU**
- **8 Go RAM**
- **160 Go SSD**
- **Docker Compose**
- **PostgreSQL local au serveur**
- **Nginx TLS same-origin**
- **1 domaine public unique**

## Variables serveur

Option la plus rapide pour un vrai domaine : générer directement les deux fichiers prêts à l’emploi.

```bash
sudo mkdir -p /etc/lifys
sudo bash deploy/ubuntu-24.04/prepare-domain-config.sh \
  --domain lifys.example \
  --email ops@lifys.example \
  --resend-key re_xxxxxxxxx \
  --server-env /etc/lifys/server.env \
  --app-env /opt/lifys-platform/.env
```

Ce générateur :

- crée `/etc/lifys/server.env` ;
- crée `/opt/lifys-platform/.env` ;
- génère un `JWT_SECRET` fort ;
- génère un `POSTGRES_PASSWORD` fort ;
- force un déploiement `same-origin` prêt pour le vrai domaine.

## Variables serveur manuelles

Copiez ce fichier :

```bash
sudo mkdir -p /etc/lifys
sudo cp deploy/ubuntu-24.04/server.env.example /etc/lifys/server.env
sudo nano /etc/lifys/server.env
```

Renseignez au minimum :

- `APP_DIR=/opt/lifys-platform`
- `APP_USER=lifys`
- `APP_GROUP=lifys`
- `APP_DOMAIN=votre-domaine`
- `APP_BRANCH=main`
- `REPO_REMOTE=https://github.com/nguyenphuhohai-CEO/lifys-platform.git`
- `COMPOSE_FILE=docker-compose.public.yml`
- `SSH_PORT=22`
- `LETSENCRYPT_EMAIL=ops@votre-domaine`

## 1. Bootstrap du serveur

```bash
sudo bash deploy/ubuntu-24.04/setup-vps.sh /etc/lifys/server.env
```

Ce script :

- installe Docker Engine + Docker Compose plugin ;
- crée l’utilisateur d’exploitation ;
- prépare les répertoires persistants ;
- active `ufw`, `fail2ban` et `unattended-upgrades`.

## 2. Déployer le dépôt

```bash
sudo bash deploy/ubuntu-24.04/deploy.sh /etc/lifys/server.env
```

Si vous n’avez pas déjà utilisé `prepare-domain-config.sh`, créez ensuite le fichier applicatif :

```bash
cd /opt/lifys-platform
cp .env.production.example .env
nano .env
```

Valeurs importantes :

- `APP_DOMAIN`
- `APP_BASE_URL=https://<domaine>`
- `CORS_ORIGIN=https://<domaine>`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `VITE_API_BASE_URL=` vide

## 3. Émettre le certificat TLS

```bash
sudo bash /opt/lifys-platform/deploy/ubuntu-24.04/bootstrap-tls.sh /etc/lifys/server.env
```

Le script :

- génère un certificat temporaire si nécessaire ;
- démarre `postgres`, `app` et `nginx` ;
- émet le certificat Let’s Encrypt via webroot ;
- recharge Nginx avec le certificat réel.

## 4. Planifier backups et renouvellement TLS

```bash
sudo bash /opt/lifys-platform/deploy/ubuntu-24.04/install-systemd-jobs.sh /etc/lifys/server.env
```

Timers installés :

- `lifys-backup.timer` : dump PostgreSQL quotidien
- `lifys-cert-renew.timer` : tentative quotidienne de renouvellement TLS

## 5. Vérifications finales

```bash
docker compose -f /opt/lifys-platform/docker-compose.public.yml ps
curl -I https://<domaine>/healthz
curl -I https://<domaine>/
```

## 6. Bootstrap exploitation

```bash
cd /opt/lifys-platform
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='change-me-now' \
ADMIN_ROLE=admin \
npm run seed:admin
```

## Flux one-shot recommandé

Sur un vrai serveur Ubuntu 24.04 :

```bash
sudo mkdir -p /etc/lifys
sudo bash deploy/ubuntu-24.04/prepare-domain-config.sh \
  --domain lifys.example \
  --email ops@lifys.example \
  --resend-key re_xxxxxxxxx \
  --server-env /etc/lifys/server.env \
  --app-env /opt/lifys-platform/.env

sudo bash deploy/ubuntu-24.04/setup-vps.sh /etc/lifys/server.env
sudo bash deploy/ubuntu-24.04/deploy.sh /etc/lifys/server.env
sudo bash /opt/lifys-platform/deploy/ubuntu-24.04/bootstrap-tls.sh /etc/lifys/server.env
sudo bash /opt/lifys-platform/deploy/ubuntu-24.04/install-systemd-jobs.sh /etc/lifys/server.env
```

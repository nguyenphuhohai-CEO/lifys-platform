# Déploiement public Lifys

> Variante cible exacte recommandée : `deploy/ubuntu-24.04/README.md`

## Pré-requis

- un domaine public pointant vers l’hôte (`APP_DOMAIN`) ;
- Docker Engine + Docker Compose ;
- certificats TLS présents sur l’hôte :
  - `deploy/certs/fullchain.pem`
  - `deploy/certs/privkey.pem`
- secrets de production définis dans `.env`.

## Variables minimales

À partir de `.env.production.example`, définissez au minimum :

- `APP_DOMAIN`
- `APP_BASE_URL=https://<APP_DOMAIN>`
- `CORS_ORIGIN=https://<APP_DOMAIN>`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Laissez `VITE_API_BASE_URL=` vide pour un déploiement same-origin derrière Nginx.

## Premier déploiement

```bash
cp .env.production.example .env
mkdir -p deploy/certs deploy/acme backups
docker compose -f docker-compose.public.yml up --build -d
```

Pour un serveur cible réel **Hetzner / OVH sur Ubuntu 24.04**, suivez plutôt la procédure détaillée dans :

- `deploy/ubuntu-24.04/README.md`
- `deploy/ubuntu-24.04/setup-vps.sh`
- `deploy/ubuntu-24.04/deploy.sh`
- `deploy/ubuntu-24.04/bootstrap-tls.sh`
- `deploy/ubuntu-24.04/install-systemd-jobs.sh`

## Vérifications post-déploiement

```bash
docker compose -f docker-compose.public.yml ps
curl -I https://$APP_DOMAIN/healthz
curl -I https://$APP_DOMAIN/
```

Points attendus :

- Nginx répond sur `80` et `443`
- `http://<APP_DOMAIN>` redirige vers HTTPS
- `https://<APP_DOMAIN>/healthz` répond `200`
- le service `app` est `healthy`
- le service `postgres` est `healthy`

## Création du premier compte d’exploitation

```bash
docker compose -f docker-compose.public.yml exec app \
  env ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change-me-now' ADMIN_ROLE=admin \
  npm run seed:admin
```

## Rollback rapide

1. identifier l’image/tag précédent encore disponible ;
2. remettre le tag précédent dans votre déploiement ;
3. relancer :

```bash
docker compose -f docker-compose.public.yml up -d
```

4. vérifier `https://$APP_DOMAIN/healthz` ;
5. n’appliquer aucune migration destructive sans sauvegarde préalable.

## Redéploiement applicatif

```bash
docker compose -f docker-compose.public.yml pull
docker compose -f docker-compose.public.yml up -d --build
```

## Sauvegarde avant release

```bash
docker compose -f docker-compose.public.yml run --rm backup
ls -lh backups/
```

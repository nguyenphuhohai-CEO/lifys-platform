# Exploitation publique Lifys

> Cible serveur exacte documentée : `deploy/ubuntu-24.04/README.md`

## Santé de service

- application : `https://<APP_DOMAIN>/healthz`
- API : `https://<APP_DOMAIN>/api/health`
- Docker healthchecks :
  - `app`
  - `postgres`
  - `nginx`

## Logs

Les services `app`, `postgres` et `nginx` utilisent une rotation Docker :

- `max-size=10m`
- `max-file=5`

Lecture rapide :

```bash
docker compose -f docker-compose.public.yml logs -f app
docker compose -f docker-compose.public.yml logs -f nginx
docker compose -f docker-compose.public.yml logs -f postgres
```

## Monitoring / alerting minimal

Déclenchez une alerte opérationnelle si :

- `/healthz` ne répond plus ;
- un conteneur quitte l’état `healthy` ;
- les redémarrages d’un service augmentent ;
- les erreurs 5xx backend ou reverse proxy augmentent ;
- les sauvegardes `backups/*.dump` cessent d’être produites.

Recommandation simple :

- supervision uptime externe sur `https://<APP_DOMAIN>/healthz`
- collecte des logs Docker vers votre plateforme d’observabilité
- alerte e-mail/Slack/PagerDuty sur échec healthcheck ou absence de backup

## Sauvegarde PostgreSQL

Création manuelle :

```bash
docker compose -f docker-compose.public.yml run --rm backup
```

Restauration :

```bash
docker compose -f docker-compose.public.yml exec -T postgres \
  pg_restore --clean --if-exists --dbname=lifys /backups/<fichier>.dump
```

Montez `./backups:/backups` sur l’hôte et externalisez ce répertoire dans votre stratégie de sauvegarde hors-machine.

Sur la cible Ubuntu 24.04 Hetzner / OVH, la planification peut être installée automatiquement via :

```bash
sudo bash /opt/lifys-platform/deploy/ubuntu-24.04/install-systemd-jobs.sh /etc/lifys/server.env
```

## Rotation / rétention recommandée

- conserver plusieurs dumps horodatés ;
- copier les backups hors du serveur ;
- tester régulièrement la restauration sur un environnement séparé.

## Certificats TLS

- placez les certificats dans `deploy/certs/`
- le webroot ACME est `deploy/acme/`
- Nginx sert `/.well-known/acme-challenge/` sur le port 80

## Incident / rollback

1. vérifier `docker compose ... ps`
2. lire les logs `nginx`, `app`, `postgres`
3. exécuter une sauvegarde si la base est encore saine
4. revenir à l’image précédente si nécessaire
5. revalider `/healthz`

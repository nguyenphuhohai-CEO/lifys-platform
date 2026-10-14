# Lifys Platform

Lifys est maintenant un **MVP full-stack durci** : frontend **React + Vite** connecté à un backend **Express + JWT** avec exécution **SQLite locale** ou **PostgreSQL** pour une expérience de rencontre multi-catégories : **Amical**, **Amoureux**, **Sans lendemain**, **Mariage** et **Professionnel**, exploitable aussi en **déploiement public maîtrisé**.

L’application reste encore volontairement **locale et partiellement simulée** :

- les comptes, profils, matchs et messages sont persistés dans votre instance locale ;
- les profils de découverte peuvent rester fictifs uniquement si le mode démo explicite est activé ;
- aucune vérification d’identité réelle n’est effectuée ;
- aucun paiement ou temps réel WebSocket n’est encore présenté comme existant.

## Aperçu

Le MVP propose :

- une landing page premium, sobre, chaleureuse et responsive ;
- une navigation desktop / tablette / mobile avec menu mobile ;
- un profil éditable avec validation accessible ;
- un fallback avatar par initiales ;
- des centres d’intérêt nettoyés et formatés ;
- une découverte filtrable par catégorie, texte et ville ;
- des actions Like / Pass accessibles ;
- des actions Bloquer / Signaler minimales sur les profils ;
- des matchs persistés avec accès direct à la messagerie ;
- des conversations persistées avec envoi par `Enter` ;
- des liens e-mail de vérification et reset exploitables via `APP_BASE_URL` ;
- des notifications non bloquantes ;
- une récupération sûre du `localStorage` si des données JSON d’interface sont corrompues ;
- une réinitialisation complète du prototype local ;
- une restauration de session via refresh token en cookie httpOnly après reload ;
- un jeton CSRF en cookie compagnon pour protéger les endpoints de session basés cookie ;
- une vérification e-mail avec envoi configurable et fallback preview explicite ;
- une réinitialisation de mot de passe avec envoi configurable et fallback preview explicite ;
- un rate limiting minimal sur auth et écritures sensibles côté Express ;
- un envoi d’e-mails configurable via Resend avec fallback preview explicite hors production ;
- des migrations SQL versionnées et un schéma cible PostgreSQL ;
- une suppression de compte avec purge serveur ;
- des actions de blocage / signalement minimales ;
- une console frontend de modération pour `admin` / `moderator` ;
- un coach local orienté produit/profil sans appel externe ;
- un seed admin/modérateur pour l’exploitation ;
- une healthcheck enrichie et des logs structurés ;
- un runtime PostgreSQL optionnel pour le déploiement public ;
- un conteneur multi-stage, un `docker-compose.public.yml`, un reverse proxy Nginx et une CI/CD GitHub Actions.
- un healthcheck conteneur applicatif et un arrêt propre du serveur ;
- des variables de build frontend injectables dans l’image GHCR pour le déploiement public.

## Installation

```bash
npm install
cp .env.example .env
```

Pour une configuration de déploiement durcie :

```bash
cp .env.production.example .env
```

Définissez ensuite `NODE_ENV=production` dans l’environnement du processus serveur (systemd, Docker, PaaS, reverse proxy launch command), plutôt que dans le fichier `.env` consommé aussi par Vite.

Variables utiles pour le backend local :

- `JWT_SECRET` : secret JWT à remplacer hors démo ;
- `JWT_EXPIRES_IN` : durée de vie du token d’accès ;
- `APP_BASE_URL` : URL publique utilisée dans les liens e-mail ;
- `VITE_API_BASE_URL` : URL de l’API Express injectée **au build frontend** ; laissez vide pour un déploiement same-origin derrière reverse proxy ;
- `DATABASE_PROVIDER` : `sqlite` en local ou `postgres` pour le déploiement public ;
- `DATABASE_URL` : URL PostgreSQL quand `DATABASE_PROVIDER=postgres` ;
- `DATABASE_SSL` : active SSL côté client PostgreSQL ;
- `DATABASE_SSL_REJECT_UNAUTHORIZED` : active la validation stricte du certificat PostgreSQL ;
- `DATABASE_POOL_MAX` : taille max du pool PostgreSQL ;
- `DATABASE_POOL_IDLE_TIMEOUT_MS` : délai avant libération d’une connexion idle PostgreSQL ;
- `DATABASE_POOL_CONNECTION_TIMEOUT_MS` : délai max d’ouverture d’une connexion PostgreSQL ;
- `REFRESH_COOKIE_NAME` : nom du cookie httpOnly de refresh ;
- `CSRF_COOKIE_NAME` : nom du cookie CSRF lisible côté frontend ;
- `VITE_CSRF_COOKIE_NAME` : nom attendu côté client pour relire ce cookie au build frontend ;
- `EMAIL_DELIVERY_MODE` : `preview` ou `resend` ;
- `RESEND_API_KEY` : clé API Resend ;
- `EMAIL_FROM` : expéditeur transactionnel ;
- `REFRESH_TOKEN_TTL_DAYS` : durée de vie du refresh token ;
- `EMAIL_VERIFICATION_TOKEN_TTL_HOURS` : durée de vie du token de vérification locale ;
- `PASSWORD_RESET_TOKEN_TTL_MINUTES` : durée de vie du token de reset local ;
- `COOKIE_SECURE` : active le flag `Secure` du cookie refresh ;
- `CORS_ORIGIN` : origine frontend autorisée si frontend et API sont servis séparément ;
- `RATE_LIMIT_WINDOW_MS` : fenêtre du rate limiting Express ;
- `AUTH_RATE_LIMIT_MAX` : plafond sur inscription / connexion ;
- `WRITE_RATE_LIMIT_MAX` : plafond sur profil / likes / pass / messages / reset.
- `DEMO_DISCOVERY_ENABLED` : active explicitement les profils fictifs de découverte ;
- `LOG_LEVEL` : niveau des logs structurés ;
- `LOG_REQUESTS` : active les logs HTTP minimaux.
- `ALLOW_SQLITE_IN_PRODUCTION` : accusé de réception explicite si SQLite reste utilisé en production mono-instance.
- `TRUST_PROXY` : active la confiance proxy Express derrière Nginx / load balancer ;
- `FORCE_HTTPS` : redirige les requêtes HTTP vers `APP_BASE_URL` ;
- `STATIC_ASSET_MAX_AGE_SECONDS` : durée de cache des assets statiques servis par Express.

## Scripts

```bash
# développement frontend
npm run dev

# développement backend local
npm run dev:server

# build de production frontend
npm run build

# tests Node existants
npm test

# appliquer / vérifier les migrations
npm run migrate

# créer / promouvoir un compte admin ou moderator
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=change-me ADMIN_ROLE=admin npm run seed:admin

# lancer le serveur Express (et servir dist si build présent)
npm start
```

Pour lancer le MVP full-stack local :

```bash
npm run dev:server
npm run dev -- --host
```

## Fonctionnalités

### Landing page & navigation

- branding premium et lisible ;
- navigation clavier ;
- états hover / active / focus ;
- responsive desktop / tablette / mobile ;
- respect de `prefers-reduced-motion`.

### Profil

- validation accessible des champs principaux ;
- aperçu en direct ;
- avatar fallback si l’image est absente ou cassée ;
- intérêts normalisés sous forme lisible ;
- persistance backend sur SQLite locale.

### Découverte

- filtres par catégorie ;
- recherche texte ;
- filtre par ville ;
- compteur de profils ;
- exclusion des profils déjà likés ou passés ;
- états vides clairs.

### Matchs

- création persistée de matchs à partir d’affinités simulées ;
- explication courte de la raison du match ;
- action directe vers la messagerie.

### Messages

- liste de conversations ;
- état vide si rien n’est sélectionné ;
- envoi au clavier avec `Enter` ;
- persistance backend des messages ;
- meilleure lisibilité des bulles et de la sélection active.

### Coach local

- recommandations locales calculées dans le navigateur ;
- priorisation des actions profil / découverte / messages ;
- aucun appel IA externe.

### Robustesse locale

- lecture JSON sécurisée de `localStorage` avec fallback pour l’état de navigation local ;
- nettoyage des clés corrompues ;
- réinitialisation complète des données du prototype ;
- message explicite lorsque le navigateur refuse la persistance locale ;
- suppression définitive de compte avec purge des données côté serveur.

### Modération & exploitation

- rôles `member`, `moderator`, `admin` ;
- listing des signalements via `GET /api/admin/reports` ;
- traitement des signalements via `PATCH /api/admin/reports/:reportId` ;
- console frontend de revue avec notes et changement d’état ;
- script `npm run seed:admin` pour créer ou promouvoir un compte d’exploitation.

### Déploiement public

- runtime PostgreSQL activable via `DATABASE_PROVIDER=postgres` ;
- support reverse proxy avec `TRUST_PROXY` et `FORCE_HTTPS` ;
- validation stricte de certificat PostgreSQL configurable ;
- tuning du pool PostgreSQL via variables d’environnement ;
- cache statique configuré via `STATIC_ASSET_MAX_AGE_SECONDS` ;
- build frontend publiable avec `VITE_API_BASE_URL` / `VITE_CSRF_COOKIE_NAME` ;
- `Dockerfile` multi-stage ;
- `docker-compose.public.yml` avec app + PostgreSQL + Nginx ;
- workflows GitHub Actions pour CI et publication d’image GHCR.

## Architecture

```text
src/
  App.jsx                 # shell principal branché à l’API backend
  components/
    Avatar.jsx            # avatar + fallback initiales
    ToastRegion.jsx       # notifications non bloquantes
  data/
    demoData.js           # catégories et profils fictifs
  lib/
    api.js                # client API fetch centralisé + credentials cookie
  utils/
    app-utils.js          # filtrage, matching, sanitization
    app-utils.test.js     # tests ciblés utilitaires/localStorage
    local-ai.js           # coach local déterministe sans appel externe
    storage.js            # lecture/écriture/reset localStorage sûrs
  styles.css              # design system et responsive UI

server/
  controllers/           # contrôleurs Express (auth)
  email-service.js       # envoi preview / Resend
  logger.js              # logs structurés JSON
  migrate.js             # exécution manuelle des migrations
  migrations/            # migrations SQL versionnées SQLite
  postgres/schema.sql    # schéma cible PostgreSQL
  services/              # logique métier auth/session/tokens
  validation.js          # validation de payload backend
  http.js                # erreurs HTTP partagées
  app.js                 # API Express
  auth.js                # helpers JWT / mot de passe
  db.js                  # factory SQLite/PostgreSQL
  postgres-db.js         # adaptateur runtime PostgreSQL
  seed-admin.js          # bootstrap admin/modérateur

deploy/
  nginx.public.conf      # template reverse proxy / TLS / ACME / forwarded headers
  ubuntu-24.04/          # cible VPS Ubuntu 24.04 Hetzner/OVH + scripts ops

.github/workflows/
  ci.yml                 # tests + build
  publish-image.yml      # publication GHCR
```

## Limites du MVP full-stack local

- aucune vérification d’identité ;
- aucun paiement ;
- une vraie prod publique demande encore secrets, domaine, HTTPS, observabilité et conformité ;
- aucune synchronisation temps réel entre appareils ;
- aucune messagerie temps réel ;
- la modération reste minimale malgré une console de pilotage locale ;
- les profils de découverte peuvent rester fictifs si `DEMO_DISCOVERY_ENABLED=true`.

## Roadmap recommandée

### Étapes restantes après mise en prod publique

- enrichir les workflows de modération (assignation, historique, preuves, audit trail) ;
- brancher la messagerie temps réel ;
- finaliser conformité légale et RGPD ;
- industrialiser l’observabilité selon votre plateforme cible.

## Déploiement public recommandé

### Via conteneurs

```bash
cp .env.production.example .env
mkdir -p deploy/certs deploy/acme backups
docker compose -f docker-compose.public.yml up --build -d
```

Par défaut, l’exemple privilégie un **déploiement same-origin** derrière Nginx :

- définissez `APP_DOMAIN` sur le vrai domaine public ;
- laissez `VITE_API_BASE_URL=` vide pour que le frontend appelle `/api` sur le même domaine ;
- gardez `CORS_ORIGIN` aligné avec `APP_BASE_URL` ;
- n’utilisez une URL API distincte que si vous la fournissez explicitement **au build**.

Le reverse proxy public livré gère :

- écoute `80/443` ;
- redirection HTTP → HTTPS ;
- terminaison TLS via `TLS_CERT_PATH` / `TLS_KEY_PATH` ;
- webroot ACME `deploy/acme/` ;
- endpoint `https://<domaine>/healthz`.

Pour la publication GHCR via GitHub Actions, renseignez si nécessaire les variables de dépôt :

- `VITE_API_BASE_URL`
- `VITE_CSRF_COOKIE_NAME`

### Préparer le premier compte d’exploitation

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='change-me-now' \
ADMIN_ROLE=admin \
npm run seed:admin
```

### Endpoints d’exploitation

- `GET /api/health`
- `GET /api/admin/reports?status=open`
- `PATCH /api/admin/reports/:reportId`

### Guides d’exploitation

- `DEPLOYMENT.md` : déploiement, rollback, bootstrap exploitation
- `OPERATIONS.md` : logs, monitoring, alerting, backups, restauration
- `deploy/ubuntu-24.04/README.md` : cible exacte Hetzner/OVH Ubuntu 24.04

## Avertissement sécurité

Ce dépôt reste un **MVP full-stack local durci**.  
Ne pas y saisir de données sensibles réelles. Avant toute exploitation publique, prévoir au minimum :

- authentification et sessions durcies ;
- `EMAIL_DELIVERY_MODE=resend` avec `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, `JWT_SECRET` fort et `COOKIE_SECURE=true` ;
- `CORS_ORIGIN` limité au vrai frontend et `DEMO_DISCOVERY_ENABLED=false` ;
- si SQLite reste utilisé, `ALLOW_SQLITE_IN_PRODUCTION=true` ne vaut que pour un déploiement mono-instance explicitement assumé ;
- backend validé côté sécurité ;
- stockage serveur adapté et sauvegardé ;
- protection contre l’injection, l’abus et le spam ;
- HTTPS ;
- politique de confidentialité et conformité légale adaptées.

## Vérifications réalisées

- `npm test`
- `npm run build`
- `npm audit --omit=dev`
- smoke test `/api/health`

## Vérifications à documenter dans la pull request

- résumé des changements UX/UI ;
- confirmation du fonctionnement frontend/backend local ;
- confirmation du mode e-mail (`preview` ou `resend`) ;
- confirmation du mode découverte (`DEMO_DISCOVERY_ENABLED`) ;
- résultats de `npm test` ;
- résultats de `npm run build` ;
- résultats de `npm audit --omit=dev` ;
- scan des secrets sur les fichiers modifiés.

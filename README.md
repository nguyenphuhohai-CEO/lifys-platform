# Lifys Platform

Lifys est désormais un **MVP full-stack léger** pour une plateforme de rencontres multi-catégories.  
Le frontend reste en **React + Vite**, et le déploiement repose maintenant sur un **backend Express**, une **base SQLite réelle** et une **authentification JWT**.

Catégories disponibles :

- Amical
- Amoureux
- Sans lendemain
- Mariage
- Professionnel

## Aperçu

Le dépôt livre :

- une landing page premium et responsive ;
- une navigation desktop / tablette / mobile ;
- une authentification e-mail / mot de passe ;
- un profil utilisateur persistant en base ;
- une découverte de profils alimentée par API ;
- des likes / passes stockés côté serveur ;
- des matchs persistés ;
- une messagerie persistante ;
- une réinitialisation de l’espace de démonstration ;
- un fallback robuste pour les quelques données encore stockées dans `localStorage` côté client (jeton/session).

## Stack

### Frontend

- React 18
- Vite 5
- CSS personnalisé

### Backend

- Node.js
- Express 5
- SQLite via `better-sqlite3`
- `bcryptjs` pour le hash des mots de passe
- `jsonwebtoken` pour les sessions JWT

### Tests

- `node --test`

## Installation

```bash
npm install
cp .env.example .env
```

## Variables d’environnement

```env
PORT=3001
DATABASE_FILE=./data/lifys.sqlite
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
TRUST_PROXY=0
```

En production (`NODE_ENV=production`), `JWT_SECRET` est obligatoire (32 caractères minimum) et `TRUST_PROXY` vaut `1` par défaut (déploiement derrière un reverse proxy). Les routes `/api/auth` sont limitées à 30 requêtes par 15 minutes et par IP, et les en-têtes de sécurité (CSP, HSTS, etc.) sont activés. Montez `DATABASE_FILE` sur un volume persistant.

Pages de catégories : `/Amical`, `/Amoureux`, `/Sans-lendemain`, `/Mariage`, `/Professionnel`. Pages légales : `/cgu`, `/confidentialite`, `/mentions-legales`.

### Mise en production : e-mail, modération, profils

```env
APP_URL=https://lifys.com
SMTP_URL=smtps://user:pass@smtp.example.com:465
MAIL_FROM="Lifys <no-reply@lifys.com>"
ADMIN_EMAILS=vous@lifys.com
# valeurs par défaut en production :
REQUIRE_EMAIL_VERIFICATION=true
SEED_DEMO_DATA=false
```

- **Vérification e-mail** : active par défaut en production (`SMTP_URL` obligatoire). Sans SMTP en développement, les e-mails sont affichés dans la console du serveur.
- **Profils** : en production, les profils de démonstration sont supprimés au démarrage ; seuls de vrais membres vérifiés apparaissent, et un match exige un like réciproque (en dev, les profils démo restent disponibles).
- **Modération** : signalement et blocage par les membres ; les comptes listés dans `ADMIN_EMAILS` utilisent `GET /api/admin/reports` et `POST /api/admin/reports/:id/resolve` (`{"action":"dismiss"|"suspend"}`).
- **RGPD** : export (`GET /api/account/export`) et suppression (`DELETE /api/account`) depuis la page Profil.

Node.js 22 ou 24 requis (`better-sqlite3` 12).

## Scripts

```bash
# frontend Vite
npm run dev

# backend Express
npm run dev:server

# build frontend
npm run build

# lancer le serveur backend (et servir dist si build présent)
npm start

# tests ciblés
npm test
```

## Fonctionnalités implémentées

### Authentification

- création de compte ;
- connexion ;
- session JWT persistée localement côté navigateur ;
- routes backend protégées.

### Profil

- édition avec validation accessible ;
- avatar fallback ;
- normalisation des centres d’intérêt ;
- sauvegarde SQLite.

### Découverte

- filtres par catégorie ;
- recherche texte ;
- filtre par ville ;
- exclusion des profils déjà likés ou passés ;
- alimentation par API backend.

### Matchs

- création de correspondances persistées ;
- logique de matching légère basée sur :
  - like mutuel ;
  - catégorie commune ;
  - ville commune ;
  - centres d’intérêt communs ;
  - profils démo pour conserver l’expérience MVP.

### Messages

- conversations persistées en base ;
- envoi avec `Enter` ;
- récupération après redémarrage du serveur.

## Déploiement

- **Render** : `render.yaml` (service Docker + disque persistant `/data` pour SQLite). Créer un *Blueprint* depuis le dépôt, puis renseigner les variables marquées `sync: false`.
- **Docker** : `docker build -t lifys .` puis `docker run -p 3001:3001 -v lifys-data:/data -e JWT_SECRET=... -e APP_URL=https://... -e SMTP_URL=... lifys`.
- **E-mails** : `SMTP_URL` (ex. `smtps://user:pass@smtp.example.com:465`) et `MAIL_FROM` ; l’adresse d’envoi doit appartenir à un domaine authentifié (SPF/DKIM) chez votre fournisseur (Brevo, Mailjet, Postmark, Amazon SES…). Au démarrage, le log indique `SMTP: connexion OK` ou l’erreur. En production, `SMTP_URL` est obligatoire tant que la vérification d’e-mail est active.
- Santé : `GET /api/health`. Sauvegardez régulièrement le fichier `/data/lifys.sqlite`.

## Photos et sauvegardes

- **Photos** : les membres téléversent une image JPEG/PNG/WebP (3 Mo max, format vérifié par signature) depuis la page Profil. Les fichiers sont stockés dans `UPLOAD_DIR` (`/data/uploads` en production), servis sous `/uploads/` et supprimés au remplacement de la photo ou à la suppression du compte. Les URL externes restent acceptées.
- **Sauvegardes** : en production, la base SQLite est copiée à chaud toutes les `BACKUP_INTERVAL_HOURS` (24 h) dans `BACKUP_DIR` (`/data/backups`) ; les `BACKUP_KEEP` (14) plus récentes sont conservées. Restauration : arrêter le service, remplacer `lifys.sqlite` par la copie voulue, redémarrer. Ces copies sont sur le même disque : activez aussi les *snapshots* du disque Render et copiez régulièrement `/data` hors site (photos incluses).

## Offres : gratuit avec publicités / Premium sans publicités

Deux formules : **Gratuit** (publicités affichées) et **Premium** (abonnement mensuel, aucune publicité). Le plan est stocké sur le compte (plan) et exposé dans le profil ; les emplacements publicitaires (AdSlot) disparaissent pour les abonnés. Le paiement passe par Stripe Checkout : configurer STRIPE_SECRET_KEY, STRIPE_PREMIUM_PRICE_ID, STRIPE_WEBHOOK_SECRET (voir .env.example) et déclarer le webhook POST /api/billing/webhook (événements checkout.session.completed, customer.subscription.updated, customer.subscription.deleted). Par défaut, les publicités sont un encart interne. Avec ADSENSE_CLIENT_ID et ADSENSE_SLOT_ID, Google AdSense est activé : la CSP est élargie automatiquement, un bandeau de consentement (Accepter/Refuser, modifiable via « Gérer les cookies » en pied de page) s’affiche, et le script publicitaire n’est chargé qu’après acceptation. Le bandeau et les publicités disparaissent pour les abonnés Premium.

## Langues

L’interface est disponible en français (par défaut), anglais, espagnol et vietnamien. La langue est détectée depuis le navigateur puis mémorisée (lifys.lang) ; un sélecteur figure dans le pied de page et l’en-tête. Les textes sont des paires dans src/i18n/rows.js (clé = français) et src/i18n/legalRows.js ; un test vérifie leur complétude. Les e-mails de vérification sont envoyés dans la langue choisie. Les textes juridiques traduits sont indicatifs : seule la version française fait foi.

## Architecture

```text
server/
  app.js              # routes API + middleware
  auth.js             # validation auth, hash, JWT
  config.js           # configuration environnement
  db.js               # schéma SQLite, seed, accès données
  index.js            # démarrage HTTP
  app.test.js         # test d’intégration backend

src/
  App.jsx             # UI principale connectée à l’API
  components/
    Avatar.jsx
    ToastRegion.jsx
  data/
    demoData.js       # profils/catégories de démonstration
  lib/
    api.js            # client fetch API
  utils/
    app-utils.js
    app-utils.test.js
    storage.js        # persistance locale robuste du jeton
  styles.css
```

## Déploiement

Le dépôt inclut :

- `Dockerfile`
- `.dockerignore`
- backend capable de servir les fichiers statiques `dist/` après build

### Déploiement simple

```bash
npm install
npm run build
npm start
```

### Déploiement Docker

```bash
docker build -t lifys-platform .
docker run -p 3001:3001 \
  -e JWT_SECRET=un-secret-fort \
  -e DATABASE_FILE=/app/data/lifys.sqlite \
  lifys-platform
```

## Limites actuelles

Ce MVP reste volontairement limité :

- pas de paiement ;
- pas de vérification d’identité (uniquement de l’adresse e-mail) ;
- pas de temps réel WebSocket ;
- modération manuelle via signalements (API admin, pas encore d’interface) ;
- SQLite adapté au MVP, pas à une très forte montée en charge ;
- les textes légaux (`src/pages/LegalPage.jsx`) sont des modèles à compléter (`[À COMPLÉTER]`) et à faire valider par un juriste.

## Roadmap recommandée

### Backend

- séparation services / repositories ;
- rate limiting ;
- validation centralisée ;
- journalisation structurée.

### Auth

- rotation / révocation des tokens ;
- reset mot de passe ;
- e-mail de vérification ;
- sessions multiples.

### Base de données

- migration vers PostgreSQL ;
- migrations versionnées ;
- index avancés ;
- audit trail.

### Temps réel

- WebSocket ;
- indicateur de présence ;
- notifications push ;
- lecture/non-lu.

## Avertissement sécurité

Même avec backend réel, ce projet reste un MVP.  
Ne pas y stocker de données sensibles réelles sans :

- secret JWT fort ;
- HTTPS ;
- sauvegardes ;
- politique de rotation des secrets ;
- validation/limitation de débit ;
- conformité légale adaptée à un produit de rencontre réel.

## Vérifications

À documenter dans la pull request :

- `npm test`
- `npm run build`
- scan des secrets sur les fichiers modifiés
- test manuel du backend et du frontend connecté






## Sites séparés par catégorie

Chaque catégorie est un site à part entière (`/Amical`, `/Amoureux`, `/Sans-lendemain`, `/Mariage`, `/Professionnel`) avec sa marque, son thème, son vocabulaire et **ses propres comptes** : un même e-mail peut s'inscrire sur plusieurs sites, avec des profils, des mails de découverte, des matchs et des abonnements indépendants. L'API (`/api/auth/register` et `/api/auth/login`) reçoit le site via `mode` / `site`. La page `/` est un portail qui renvoie vers les 5 sites. Les bases existantes sont migrées automatiquement (site déduit du mode du profil).

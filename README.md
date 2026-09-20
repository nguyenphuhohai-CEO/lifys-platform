# Lifys Platform

Lifys est maintenant un **MVP full-stack local durci** : frontend **React + Vite** connecté à un backend **Express + SQLite + JWT** pour une expérience de rencontre multi-catégories : **Amical**, **Amoureux**, **Sans lendemain**, **Mariage** et **Professionnel**.

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
- un rate limiting minimal sur auth et écritures sensibles côté Express.
- un envoi d’e-mails configurable via Resend avec fallback preview explicite hors production ;
- des migrations SQL versionnées et un schéma cible PostgreSQL ;
- une suppression de compte avec purge serveur ;
- des actions de blocage / signalement minimales ;
- une healthcheck enrichie et des logs structurés.

## Installation

```bash
npm install
cp .env.example .env
```

Variables utiles pour le backend local :

- `JWT_SECRET` : secret JWT à remplacer hors démo ;
- `JWT_EXPIRES_IN` : durée de vie du token d’accès ;
- `APP_BASE_URL` : URL publique utilisée dans les liens e-mail ;
- `DATABASE_PROVIDER` : actuellement `sqlite` ;
- `REFRESH_COOKIE_NAME` : nom du cookie httpOnly de refresh ;
- `CSRF_COOKIE_NAME` : nom du cookie CSRF lisible côté frontend ;
- `VITE_CSRF_COOKIE_NAME` : nom attendu côté client pour relire ce cookie ;
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

### Robustesse locale

- lecture JSON sécurisée de `localStorage` avec fallback pour l’état de navigation local ;
- nettoyage des clés corrompues ;
- réinitialisation complète des données du prototype ;
- message explicite lorsque le navigateur refuse la persistance locale.
- suppression définitive de compte avec purge des données côté serveur.

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
  db.js                  # persistance SQLite
```

## Limites du MVP full-stack local

- aucune vérification d’identité ;
- aucun paiement ;
- backend local mono-instance, pas encore prêt pour une prod publique ;
- aucune synchronisation temps réel entre appareils ;
- aucune messagerie temps réel ;
- PostgreSQL n’est pas encore branché à l’exécution ;
- la modération reste minimale et sans interface admin dédiée ;
- les profils de découverte peuvent rester fictifs si `DEMO_DISCOVERY_ENABLED=true`.

## Roadmap recommandée

### Étapes restantes avant vraie prod publique

- brancher PostgreSQL en exécution réelle ;
- déployer frontend + API sur une cible stable avec HTTPS ;
- connecter un vrai monitoring/alerting ;
- ajouter une interface d’administration/modération ;
- brancher la messagerie temps réel ;
- finaliser conformité légale et RGPD.

## Avertissement sécurité

Ce dépôt reste un **MVP full-stack local durci**.  
Ne pas y saisir de données sensibles réelles. Avant toute mise en production future, prévoir au minimum :

- authentification et sessions durcies ;
- `EMAIL_DELIVERY_MODE=resend` avec `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, `JWT_SECRET` fort et `COOKIE_SECURE=true` ;
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

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
```

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
- pas de vérification d’identité ;
- pas de temps réel WebSocket ;
- pas de modération ;
- pas de rôles admin ;
- SQLite adapté au MVP, pas à une très forte montée en charge ;
- les profils de découverte restent des profils fictifs de démonstration.

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

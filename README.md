# Lifys Platform

Lifys est un **MVP local premium** pour une plateforme de rencontres multi-catégories.  
L’expérience principale reste en **React + Vite**, fonctionne **sans backend requis** et stocke les données du prototype dans le navigateur.

Catégories disponibles :

- Amical
- Amoureux
- Sans lendemain
- Mariage
- Professionnel

## Aperçu

Le dépôt livre :

- une landing page premium, chaleureuse et responsive ;
- une navigation clavier-friendly desktop / tablette / mobile ;
- un sélecteur de catégorie clair pour les 5 usages ;
- une découverte avec filtres par catégorie, texte et ville ;
- des cartes profil avec avatar fallback et intérêts formatés ;
- des likes / passes / matchs simulés et persistés localement ;
- une messagerie locale avec sélection de conversation et envoi par `Enter` ;
- une réinitialisation du prototype ;
- une lecture sécurisée de `localStorage` avec fallback en cas de JSON corrompu ;
- une indication explicite que les données sont locales, fictives et non vérifiées.

## Important

- Les profils de découverte sont **fictifs**.
- Les interactions sont **simulées localement**.
- Aucune **vérification d’identité réelle** n’est effectuée.
- Ne stockez pas de données personnelles sensibles dans ce MVP.

## Stack

### Frontend principal

- React 18
- Vite 5
- CSS personnalisé
- `localStorage` sécurisé via `src/utils/storage.js`

### Outils et prototype serveur

Le dépôt contient aussi un dossier `server/` (Express + SQLite + JWT) utile pour explorer une évolution future du produit, mais **le MVP livré ici reste local côté frontend** et ne dépend pas de ce serveur pour fonctionner.

### Tests

- `node --test`
- Vitest + jsdom pour les vérifications UI ciblées

## Installation

```bash
npm install
```

## Scripts

```bash
# lancer le MVP local React/Vite
npm run dev -- --host

# build de production du frontend
npm run build

# exécuter les tests Node existants
npm test

# prototype serveur optionnel présent dans le dépôt
npm run dev:server
npm start
```

## Fonctionnalités

### Landing page et navigation

- design premium, sobre et chaleureux ;
- menu mobile ;
- hover / active / focus visibles ;
- respect de `prefers-reduced-motion` ;
- raccourci "Aller au contenu principal".

### Profil

- validation accessible ;
- édition fiable ;
- avatar fallback ;
- centres d’intérêt normalisés et reformatés.

### Découverte

- filtres par catégorie ;
- recherche texte ;
- filtre par ville ;
- compteur de profils ;
- états vides cohérents ;
- exclusion des profils déjà likés ou passés ;
- persistance locale robuste.

### Matchs

- présentation claire des matchs ;
- logique de compatibilité légère basée sur :
  - la catégorie ;
  - la ville ;
  - les centres d’intérêt ;
- accès direct vers la messagerie.

### Messages

- liste des conversations ;
- état vide ;
- envoi par `Enter` ;
- meilleure lisibilité des bulles ;
- persistance locale dans le navigateur.

### Stockage local

- `safeReadJSON` nettoie les données corrompues ;
- `safeWriteJSON` protège les écritures ;
- `resetPrototypeStorage` remet le prototype à zéro ;
- l’interface signale clairement quand les données sont locales ou temporaires.

## Architecture

```text
src/
  App.jsx                  # orchestration des vues locales MVP
  components/
    Avatar.jsx             # image + fallback initiales
    ToastRegion.jsx        # notifications non bloquantes
  data/
    demoData.js            # catégories, profils et messages fictifs
  lib/
    api.js                 # client API conservé pour évolution future
  utils/
    app-utils.js           # filtrage, matching, sanitation, bootstrap local
    app-utils.test.js      # tests ciblés des utilitaires
    storage.js             # accès localStorage sécurisé
  styles.css               # design system et responsive

server/
  app.js
  auth.js
  config.js
  db.js
  index.js
  app.test.js
```

## Limites du MVP local

- pas de backend requis pour l’expérience principale ;
- pas d’authentification réelle ;
- pas de paiement ;
- pas de vérification d’identité ;
- pas de base de données distante ;
- pas de messagerie temps réel ;
- pas de modération ;
- les données sont liées au navigateur courant.

## Roadmap recommandée

### Backend

- transformer le prototype serveur en API produit clairement intégrée ;
- ajouter validation centralisée et limitation de débit ;
- séparer services, stockage et règles métier.

### Auth

- créer une authentification réelle ;
- vérifier l’e-mail ;
- réinitialiser les mots de passe ;
- gérer les sessions et la révocation.

### Base de données

- passer à PostgreSQL si le produit sort du mode MVP ;
- ajouter migrations versionnées ;
- prévoir index, audit et sauvegardes.

### Temps réel / WebSocket

- synchroniser la messagerie ;
- états lu / non lu ;
- présence ;
- notifications temps réel.

## Avertissement sécurité

Ce dépôt reste un prototype. Avant toute mise en production réelle, il faudra au minimum :

- une architecture backend clairement définie ;
- HTTPS ;
- gestion stricte des secrets ;
- conformité légale adaptée à un produit de rencontre ;
- politique de conservation et suppression des données ;
- protections anti-abus et modération.

## Vérifications

Vérifications à reporter dans la pull request :

- `npm test`
- `npm run build`
- scan des secrets sur les fichiers modifiés
- revue manuelle du MVP local responsive et de la persistance navigateur

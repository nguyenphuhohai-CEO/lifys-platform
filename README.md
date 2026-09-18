# Lifys Platform

Lifys est un **MVP local en React + Vite** pour une expérience de rencontre multi-catégories : **Amical**, **Amoureux**, **Sans lendemain**, **Mariage** et **Professionnel**.

L’application reste volontairement **locale et simulée** :

- les profils de découverte sont fictifs ;
- les likes, matchs et messages sont stockés dans le navigateur ;
- aucune vérification d’identité réelle n’est effectuée ;
- aucun paiement, backend produit ou temps réel n’est présenté comme existant.

## Aperçu

Le MVP propose :

- une landing page premium, sobre, chaleureuse et responsive ;
- une navigation desktop / tablette / mobile avec menu mobile ;
- un profil éditable avec validation accessible ;
- un fallback avatar par initiales ;
- des centres d’intérêt nettoyés et formatés ;
- une découverte filtrable par catégorie, texte et ville ;
- des actions Like / Pass accessibles ;
- des matchs simulés avec accès direct à la messagerie ;
- des conversations locales avec envoi par `Enter` ;
- des notifications non bloquantes ;
- une récupération sûre du `localStorage` si des données JSON sont corrompues ;
- une réinitialisation complète du prototype local.

## Installation

```bash
npm install
```

## Scripts

```bash
# développement frontend
npm run dev

# build de production frontend
npm run build

# tests Node existants
npm test

# socle serveur conservé dans le dépôt (non requis pour le MVP local)
npm run dev:server
npm start
```

Pour lancer le MVP local :

```bash
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
- persistance locale robuste.

### Découverte

- filtres par catégorie ;
- recherche texte ;
- filtre par ville ;
- compteur de profils ;
- exclusion des profils déjà likés ou passés ;
- états vides clairs.

### Matchs

- création locale de matchs à partir d’affinités simulées ;
- explication courte de la raison du match ;
- action directe vers la messagerie.

### Messages

- liste de conversations ;
- état vide si rien n’est sélectionné ;
- envoi au clavier avec `Enter` ;
- persistance locale des messages ;
- meilleure lisibilité des bulles et de la sélection active.

### Robustesse locale

- lecture JSON sécurisée de `localStorage` avec fallback ;
- nettoyage des clés corrompues ;
- réinitialisation complète des données du prototype ;
- message explicite lorsque le navigateur refuse la persistance locale.

## Architecture

```text
src/
  App.jsx                 # shell principal et vues du MVP local
  components/
    Avatar.jsx            # avatar + fallback initiales
    ToastRegion.jsx       # notifications non bloquantes
  data/
    demoData.js           # catégories et profils fictifs
  lib/
    api.js                # socle conservé pour une future API
  utils/
    app-utils.js          # filtrage, matching, sanitization
    app-utils.test.js     # tests ciblés utilitaires/localStorage
    storage.js            # lecture/écriture/reset localStorage sûrs
  styles.css              # design system et responsive UI

server/                   # base de travail future, non utilisée par le MVP local actuel
```

## Limites du MVP local

- aucune authentification réelle ;
- aucune vérification d’identité ;
- aucun paiement ;
- aucun backend produit actif dans l’expérience courante ;
- aucune base de données utilisée par le frontend MVP ;
- aucune synchronisation entre appareils ;
- aucune messagerie temps réel ;
- données effaçables par l’utilisateur ou par le navigateur ;
- profils de découverte entièrement fictifs.

## Roadmap recommandée

### Backend

- exposer une API sécurisée pour profils, interactions et conversations ;
- séparer services, validation et stockage ;
- ajouter limitation de débit et journalisation.

### Authentification

- comptes réels ;
- gestion de session sécurisée ;
- vérification e-mail ;
- récupération de mot de passe.

### Base de données

- stockage persistant serveur ;
- migrations versionnées ;
- indexation et audit ;
- stratégie de sauvegarde.

### Temps réel

- WebSocket ou équivalent ;
- état en ligne/hors ligne ;
- indicateurs de lecture ;
- notifications push.

## Avertissement sécurité

Ce dépôt reste un **prototype local**.  
Ne pas y saisir de données sensibles réelles. Avant toute mise en production future, prévoir au minimum :

- authentification et sessions durcies ;
- backend validé côté sécurité ;
- stockage serveur adapté ;
- protection contre l’injection, l’abus et le spam ;
- HTTPS ;
- politique de confidentialité et conformité légale adaptées.

## Vérifications réalisées

- `npm test`
- `npm run build`

## Vérifications à documenter dans la pull request

- résumé des changements UX/UI ;
- confirmation du maintien du fonctionnement local/simulé ;
- résultats de `npm test` ;
- résultats de `npm run build` ;
- scan des secrets sur les fichiers modifiés.

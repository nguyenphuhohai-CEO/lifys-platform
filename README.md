# Lifys Platform

Lifys est un MVP front-end local construit avec React + Vite pour démontrer une expérience de rencontres multi-catégories, premium et responsive. L’application couvre cinq univers : **Amical**, **Amoureux**, **Sans lendemain**, **Mariage** et **Professionnel**.

> ⚠️ **Important**  
> Ce dépôt ne contient **ni backend réel**, **ni authentification**, **ni paiement**, **ni vérification d’identité**, **ni base de données distante**, **ni messagerie temps réel**. Les profils, matchs et messages sont **fictifs**, **simulés** et stockés **uniquement dans le navigateur** via `localStorage`.

## Aperçu

Le prototype fournit :

- une landing page professionnelle et chaleureuse ;
- une navigation responsive desktop / tablette / mobile ;
- un sélecteur de catégorie pour les cinq usages Lifys ;
- une découverte de profils avec recherche texte, filtre par ville et compteur ;
- des cartes profil avec like / pass, avatar fallback et intérêts formatés ;
- des matchs simulés avec ouverture directe de la messagerie ;
- une messagerie locale plus lisible avec sélection de conversation et envoi via `Enter` ;
- un profil éditable avec validation accessible ;
- une réinitialisation complète du prototype local ;
- une récupération sécurisée des données corrompues dans `localStorage`.

## Stack

- React 18
- Vite 5
- JavaScript ES Modules
- CSS personnalisé
- Tests unitaires Node (`node --test`) sur les utilitaires métier/stockage

## Installation

```bash
npm install
```

## Scripts

```bash
npm run dev -- --host
npm run build
npm run preview
npm test
```

## Fonctionnalités MVP

### Landing page & navigation

- Hero premium avec mise en avant des catégories
- Navigation sticky
- Menu mobile dédié
- États hover / focus / active
- Respect de `prefers-reduced-motion`

### Découverte

- Filtres par catégorie
- Recherche texte
- Filtre par ville
- Compteur de profils visibles / traités
- Like / Pass accessibles
- États vides
- Persistance locale des likes et passes

### Matchs

- Génération de matchs simulés selon :
  - la catégorie principale
  - la ville
  - les centres d’intérêt communs
- Présentation professionnelle
- Action directe vers la messagerie locale

### Messages

- Liste de conversations
- Sélection d’une conversation
- État vide
- Envoi avec `Enter`
- Persistance locale

### Profil

- Validation accessible (nom, âge, ville, bio, URL d’avatar)
- Aperçu en direct
- Avatar fallback
- Centres d’intérêt normalisés automatiquement

### Stockage local

- Lecture JSON sécurisée avec fallback
- Suppression automatique des données corrompues
- Réinitialisation complète du prototype local

## Architecture

```text
src/
  App.jsx                    # orchestration UI + états
  components/
    Avatar.jsx              # avatar avec fallback
    ToastRegion.jsx         # notifications non bloquantes
  data/
    demoData.js             # modes, profils et conversations fictives
  utils/
    app-utils.js            # filtrage, matching, sanitation
    storage.js              # accès localStorage robustes
    app-utils.test.js       # tests ciblés Node
  styles.css                # design system + responsive
```

## Limites du MVP local

- aucune authentification réelle ;
- aucune protection serveur ;
- aucune synchronisation multi-appareils ;
- aucune persistance distante ;
- aucun chiffrement applicatif des données du navigateur ;
- aucune modération ou vérification des profils ;
- aucune promesse de disponibilité hors du navigateur courant.

## Roadmap recommandée

### Backend

- API sécurisée pour profils, likes, matchs et conversations
- persistance côté serveur
- gestion de sessions

### Authentification

- inscription / connexion
- gestion des rôles et sessions
- récupération de mot de passe

### Base de données

- stockage utilisateurs/profils/messages
- contraintes d’intégrité
- migrations et historique

### WebSocket / temps réel

- notifications de nouveaux messages
- statut en ligne
- conversations temps réel

## Avertissement sécurité

Ce MVP est volontairement local et démonstratif. **Ne pas** le présenter comme une plateforme réelle de rencontres ou de paiement. **Ne pas** y stocker de données personnelles sensibles, mots de passe, documents officiels, secrets API ou informations réglementées.

## Vérifications effectuées

Les vérifications attendues pour la pull request sont :

- `npm test`
- `npm run build`
- scan des fichiers modifiés pour éviter l’ajout de secrets


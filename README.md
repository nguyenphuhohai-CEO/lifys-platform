# Lifys Platform

Lifys est une **démo front-end locale** d’une plateforme de rencontre multi-catégories pensée pour une présentation produit premium, sans prétendre fournir encore un backend de production.

## Aperçu produit

L’application couvre cinq catégories conservées dans le MVP :

- **Amical**
- **Amoureux**
- **Sans lendemain**
- **Mariage**
- **Professionnel**

### Écrans disponibles

- **Landing page** avec proposition de valeur, résumé de la démo et accès rapide aux catégories
- **Découverte** avec filtres par catégorie, recherche texte, filtre ville, compteur de profils restants et actions like/pass
- **Matchs** avec statut, date simplifiée et accès direct à la messagerie
- **Messagerie** locale avec sélection de conversation, état vide, envoi via Entrée et meilleure lisibilité
- **Profil** avec aperçu, validation accessible, formatage des intérêts et avatar de secours

## Stack

- React 18
- Vite 5
- JavaScript
- CSS personnalisé

## Installation

```bash
npm install
npm run dev -- --host
```

Puis ouvrez l’URL locale affichée par Vite.

## Scripts disponibles

- `npm run dev` : lance le serveur de développement
- `npm run build` : produit le build de production
- `npm run preview` : sert localement le build produit

## Fonctionnalités MVP disponibles

- identité visuelle plus cohérente et responsive
- navigation claire avec état actif et menu mobile
- sauvegarde locale du profil, des likes, passes, matchs et messages
- lecture sécurisée de `localStorage` avec fallback si les données sont corrompues
- bouton de **réinitialisation de la démo**
- notifications non bloquantes à la place des `alert()`
- matchs et conversations générés localement
- indication visible que toutes les données sont **simulées et locales**

## Architecture du projet

```text
src/
  components/
    Avatar.jsx
    Header.jsx
    HomeView.jsx
    DiscoverView.jsx
    MatchesView.jsx
    MessagesView.jsx
    ProfileView.jsx
    Toast.jsx
  data/
    demoData.js
  lib/
    appUtils.js
    storage.js
  App.jsx
  main.jsx
  styles.css
```

### Principes

- **`components/`** : vues et briques UI réutilisables
- **`data/demoData.js`** : modes, profils et conversations de démonstration
- **`lib/storage.js`** : helpers de persistance locale et reset du prototype
- **`lib/appUtils.js`** : logique testable de validation, filtrage, matching et formatage

## Limites importantes du MVP local

Cette application **n’est pas** une plateforme de production. Elle ne fournit pas :

- authentification réelle
- backend distant
- base de données
- WebSocket / temps réel réel
- paiement ou abonnement
- vérification d’identité
- modération ou sécurité serveur

Les profils et messages présents sont **fictifs**, utilisés uniquement pour la démonstration.

## Accessibilité et UX

- boutons et labels sémantiques
- focus visibles
- noms accessibles sur les actions importantes
- respect de `prefers-reduced-motion`
- avatars avec fallback lisible
- validations inline et toasts non bloquants

## Feuille de route réaliste

1. Ajouter une authentification sécurisée et une gestion de session
2. Introduire une API backend et une base de données
3. Remplacer la messagerie locale par WebSocket / temps réel
4. Ajouter une vraie modération, signalement et gestion de contenu
5. Mettre en place des permissions, analytics, monitoring et sécurité applicative
6. Préparer ensuite une déclinaison mobile native ou cross-platform

## Avertissement sécurité et démonstration

- Toutes les données sont stockées dans le navigateur via `localStorage`
- Les informations peuvent être supprimées via le bouton de réinitialisation
- Ne saisissez pas de données réelles, sensibles ou confidentielles
- Ce dépôt est destiné à la **démonstration produit et UX**, pas à un usage public réel

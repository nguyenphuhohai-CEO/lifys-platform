# lifys-platform

Lifys est un prototype front-end local construit avec React et Vite pour démontrer une expérience de rencontre multi-catégories plus professionnelle, cohérente et prête pour une démonstration produit.

## Aperçu

Le prototype couvre cinq univers de relation :

- Amical
- Amoureux
- Sans lendemain
- Mariage
- Professionnel

L’application met l’accent sur une UI premium et responsive, des filtres de découverte, des matchs simulés, une messagerie locale et un profil utilisateur fiabilisé.

> **Important**
> - Les données sont **fictives**, **simulées** et **stockées localement** dans le navigateur.
> - Il n’y a **pas** de backend réel, d’authentification réelle, de paiement, de vérification d’identité, de WebSocket ni de base de données distante.
> - Le bouton de réinitialisation permet de repartir d’un état vierge du prototype.

## Stack

- React 18
- Vite 5
- JavaScript (ES modules)
- CSS global moderne, responsive et accessible
- `localStorage` avec lecture JSON sécurisée
- tests utilitaires ciblés via `node:test`

## Installation

```bash
npm install
npm run dev -- --host
```

Puis ouvrez l’URL locale affichée par Vite.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm test
```

## Fonctionnalités principales

- landing page premium avec rappel explicite du caractère local du MVP
- header professionnel avec navigation principale et menu mobile
- cinq catégories conservées : Amical, Amoureux, Sans lendemain, Mariage, Professionnel
- états hover/focus accessibles et respect de `prefers-reduced-motion`
- profil local éditable avec validation accessible, fallback avatar et normalisation des intérêts
- découverte de profils fictifs avec filtres par catégorie, recherche texte, filtre ville et compteurs
- actions Like / Pass accessibles avec matchs simulés cohérents
- vue matchs plus claire avec accès direct à la conversation
- messagerie locale avec envoi via bouton ou touche Entrée
- notifications non bloquantes à la place des `alert()`
- réinitialisation complète du prototype et du `localStorage`
- garde-fous contre les données JSON corrompues dans le stockage local

## Limites du MVP local

Ce projet reste un **prototype front-end de démonstration**. Il ne fournit pas encore :

- authentification sécurisée
- autorisation et gestion de session serveur
- base de données persistante distante
- vérification d’identité réelle
- moteur de matching backend
- modération, anti-abus, signalements ou conformité réglementaire
- messagerie temps réel via WebSocket
- push notifications, paiements ou abonnements

## Architecture actuelle

```text
src/
├── App.jsx
├── components/
│   ├── AppHeader.jsx
│   ├── Avatar.jsx
│   ├── DiscoverView.jsx
│   ├── HomeView.jsx
│   ├── MatchesView.jsx
│   ├── MessagesView.jsx
│   ├── ProfileView.jsx
│   └── ToastRegion.jsx
├── data/
│   └── demo.js
├── lib/
│   ├── app-utils.js
│   ├── app-utils.test.js
│   └── storage.js
├── main.jsx
└── styles.css
```

## Roadmap suggérée

### Backend
- API Node.js/TypeScript ou équivalent
- persistance centralisée des profils, likes, matchs et messages
- contrôles d’intégrité des données

### Authentification
- comptes sécurisés
- sessions, récupération de compte et gestion des rôles
- vérification progressive des profils sans sur-promesse produit

### Base de données
- PostgreSQL ou équivalent relationnel
- schéma pour profils, préférences, conversations, modération et analytics
- migrations, sauvegardes et observabilité

### Temps réel
- WebSocket ou service pub/sub pour la messagerie et les notifications
- indicateurs de présence, accusés de lecture et synchronisation multi-appareils

## Avertissement sécurité

Cette base n’est **pas prête pour la production**. Avant toute mise en ligne réelle, il faudra notamment ajouter :

- authentification et autorisation robustes
- validation serveur stricte
- protections contre les abus et la fuite de données
- stratégie de secrets et d’environnement
- chiffrement, journalisation et surveillance
- revue sécurité de l’architecture backend, de la base de données et des flux temps réel

## Vérifications recommandées

Avant de livrer une évolution du prototype :

```bash
npm test
npm run build
```

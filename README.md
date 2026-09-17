# Lifys Platform

Lifys est un MVP web **frontend-only** de plateforme de rencontres multi-catégories, repensé pour une démonstration professionnelle : design premium, UX plus fluide, architecture React découpée et données locales robustes.

> ⚠️ **Important** : ce projet reste un prototype local. Les données sont simulées et stockées dans le navigateur (`localStorage`). Aucune authentification réelle, base distante, paiement ou vérification d’identité n’est implémentée.

## Aperçu produit

L’application couvre 5 catégories conservées dans le MVP :

- 💙 Amical
- 💜 Amoureux
- 🔥 Sans lendemain
- 💍 Mariage
- 💼 Professionnel

Écrans principaux :

- Landing page avec sélection de catégorie
- Découverte de profils (filtres, like/pass, compteur restant)
- Matchs (statut + action vers messagerie)
- Messagerie locale (conversations, envoi par Enter)
- Profil (édition + validation accessible)

## Stack technique

- React 18 + Vite 5
- JavaScript (sans backend)
- CSS custom (responsive + accessibilité)

## Installation

```bash
npm install
```

## Scripts disponibles

```bash
npm run dev -- --host
npm run build
npm run preview
```

## Fonctionnalités disponibles (MVP local)

- Navigation claire avec état actif et menu mobile
- Refonte visuelle premium (typographie, hiérarchie, états interactifs)
- Filtres découverte : catégorie, recherche texte, ville
- Profil utilisateur avec validation non bloquante (toasts + erreurs accessibles)
- Avatar fallback automatique en cas d’URL invalide
- Intérêts formatés automatiquement
- Matching simulé avec statut/date locale
- Messagerie locale lisible avec état vide
- Persistance robuste avec fallback si JSON corrompu
- Bouton de réinitialisation du prototype (`localStorage`)
- Indication explicite du caractère local/simulé des données

## Architecture du projet

```text
src/
  App.jsx
  constants.js
  components/
    Header.jsx
    HomeView.jsx
    DiscoverView.jsx
    MatchesView.jsx
    MessagesView.jsx
    ProfileView.jsx
    Toast.jsx
    AvatarImage.jsx
  lib/
    storage.js
    matching.js
  styles.css
```

## Limites actuelles

Ce MVP ne fournit pas une plateforme de production :

- pas d’authentification sécurisée
- pas de backend API
- pas de base de données distante
- pas de WebSocket réel
- pas de modération serveur
- pas de sécurité applicative côté serveur

## Roadmap réaliste vers une version production

1. **Backend API** (Node/Express ou Nest) + schéma métier clair
2. **Authentification** (sessions/JWT, gestion des rôles, durcissement sécurité)
3. **Base de données** (PostgreSQL + migrations)
4. **Messagerie temps réel** (WebSocket + présence + historique)
5. **Média & conformité** (upload, modération, RGPD, journalisation)
6. **Observabilité & CI/CD** (tests, monitoring, alerting)

## Sécurité & données de démonstration

- Utiliser uniquement des profils fictifs / de démonstration
- Ne jamais considérer les données locales comme sûres
- Ne pas exposer de secrets dans le frontend
- Ne pas présenter ce MVP comme un service vérifié ou certifié

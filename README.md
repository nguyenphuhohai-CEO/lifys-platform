# lifys-platform

Lifys est un MVP **100% local** (React + Vite) d'une application de rencontre multi-catégories.
Le produit couvre cinq catégories : **Amical**, **Amoureux**, **Sans lendemain**, **Mariage** et **Professionnel**.

## Aperçu

- Landing page premium et sobre
- Navigation responsive (desktop/tablette/mobile) avec menu mobile
- Profil local éditable avec validation accessible
- Découverte avec filtres (catégorie, recherche texte, ville)
- Like / Pass, génération de matchs simulés
- Messagerie locale persistante avec envoi via Enter
- Notifications non bloquantes
- Réinitialisation du prototype local
- Protection contre les JSON corrompus dans `localStorage`

## Installation

```bash
npm install
npm run dev -- --host
```

## Scripts

- `npm run dev` : démarrage en développement
- `npm run build` : build de production Vite
- `npm run preview` : prévisualisation du build
- `npm run test` : tests unitaires (Node test runner)

## Fonctionnalités MVP

- Expérience locale simulée avec persistance navigateur
- Compteur de profils disponibles en découverte
- États UX : loading, empty, validation error
- Avatar fallback si URL invalide
- Formatage et normalisation des intérêts
- Action directe depuis Matchs vers Messages

## Limites du MVP local

Ce prototype **ne contient pas** de backend réel :

- pas d’authentification serveur
- pas de base de données distante
- pas de WebSocket temps réel
- pas de paiement/abonnement
- pas de vérification d’identité réelle

Toutes les données sont locales au navigateur de démonstration.

## Architecture

- `src/App.jsx` : orchestration UI (landing, découverte, matchs, messages, profil)
- `src/styles.css` : design system local + responsive + accessibilité visuelle
- `src/lib/storage.js` : lecture/écriture locale sécurisée et reset
- `src/lib/app-utils.js` : utilitaires de filtrage, matching, validation et sanitation
- `src/lib/*.test.js` : tests unitaires ciblés

## Roadmap (version produit)

1. Backend API (Node/Express ou équivalent)
2. Authentification sécurisée (session/JWT + gestion des rôles)
3. Base de données relationnelle (profils, likes, matchs, messages)
4. Messagerie temps réel WebSocket
5. Modération, conformité et observabilité

## Avertissement sécurité

- Ne pas stocker de secrets dans le frontend ni dans `localStorage`.
- Ce MVP n’est pas conçu pour des données personnelles réelles.
- Utiliser uniquement des profils fictifs de démonstration.

## Vérifications effectuées

- `npm run test`
- `npm run build`

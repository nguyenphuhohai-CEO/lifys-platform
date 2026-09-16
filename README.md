# Lifys Platform

Lifys est un MVP web local d'une plateforme de rencontre multi-catégories : **amical**, **amoureux**, **sans lendemain**, **mariage** et **professionnel**.

> Prototype local uniquement : pas de backend, pas de compte distant, pas de temps réel, pas de paiement, pas de vérification d'identité et aucune donnée sensible attendue.

## Fonctionnalités MVP

- Landing page responsive avec présentation de Lifys et des 5 modes
- Navigation frontend légère entre **Accueil**, **Découvrir**, **Matchs**, **Messages** et **Profil**
- Création et édition d'un profil local avec validation côté client
- Persistance dans `localStorage` du profil, du mode actif, des likes, des passes, des matchs et des messages
- Découverte de profils de démonstration avec filtres par mode, ville et intérêt
- Matching simulé basé sur le mode principal, la ville et les centres d'intérêt
- Messagerie locale de démonstration avec envoi de messages stockés dans le navigateur
- États de chargement, d'absence de données et message d'erreur pour stockage corrompu
- Focus visibles, boutons accessibles et cartes utilisables au clavier (`←` pour Pass, `→` pour Like)

## Installation

```bash
npm install
```

## Lancement en local

```bash
npm run dev
```

L'application sera accessible via l'URL affichée par Vite.

## Vérification

```bash
npm run test
npm run build
npm run lint
```

## Structure simple

- `src/App.tsx` : interface principale et navigation
- `src/data/demoProfiles.ts` : profils de démonstration non sensibles
- `src/lib/matching.ts` : logique de validation, filtrage et matching simulé
- `src/lib/storage.ts` : lecture/écriture `localStorage`

## Limites du prototype

- Aucune authentification ni synchronisation serveur
- Matchs et conversations purement simulés
- Données effaçables par l'utilisateur via le navigateur
- Profils de démonstration statiques
- Pas d'application mobile native dans ce MVP

## Prochaines étapes possibles

1. Ajouter un backend et une authentification sécurisée
2. Introduire une vraie logique de conversations et présence temps réel
3. Gérer les médias uploadés côté serveur
4. Ajouter modération, signalement et politiques de sécurité produit
5. Déployer un système de recommandations plus avancé par catégorie

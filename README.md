# lifys-platform

Lifys est un prototype local d’une plateforme de rencontre multi-catégories. Ce MVP web permet :

- de gérer un profil utilisateur dans `localStorage`
- de parcourir des profils de démonstration par mode de rencontre
- d’ajouter des likes / passes
- de générer des matchs simulés
- de consulter des conversations de démonstration
- de naviguer entre les sections Accueil, Découvrir, Matchs, Messages et Profil

## Stack

- React + Vite
- JavaScript
- CSS moderne

## Démarrage

```bash
npm install
npm run dev -- --host
```

Puis ouvrir l’URL affichée par Vite dans le navigateur.

## Fonctionnalités du MVP

- Landing page avec les 5 catégories : Amical, Amoureux, Sans lendemain, Mariage, Professionnel
- Profil utilisateur avec sauvegarde locale
- Découverte de profils de démonstration
- Likes et passes
- Matchs simulés avec persistance locale
- Messages et conversations de démonstration
- Navigation responsive dédiée au prototype

## Limites

Ce projet est un prototype front-end local. Il ne contient pas :

- authentification backend réelle
- base de données distante
- messagerie temps réel authentique
- paiements ou abonnements
- vérification d’identité
- appel vidéo
- IA de recommandation

## Prochaines étapes

1. Ajouter un backend Node/Express
2. Rendre les profils utilisateurs persistants en base de données
3. Ajouter une vraie messagerie temps réel via WebSockets
4. Introduire les catégories et filtres avancés
5. Préparer un version mobile et un tableau de bord admin

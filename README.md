# Lifys

**Lifys** est une plateforme de rencontre complète et multi-plateforme avec 5 catégories
distinctes :

- 👥 **Amical** — se faire des amis avec des intérêts communs
- ❤️ **Amoureux** — rencontres sérieuses et durables
- 🌙 **Sans Lendemain** — rencontres sans engagement
- 💍 **Mariage** — recherche de partenaire pour le mariage
- 💼 **Professionnel** — réseautage et partenariats professionnels

## Structure du dépôt

```
.
├── server/   # API backend (Node.js + Express + TypeScript + Prisma + Socket.io)
├── web/      # Application web (React + TypeScript + Vite + Tailwind CSS)
└── docker-compose.yml   # Environnement de développement local
```

Chaque application a son propre `README.md` avec les instructions détaillées
([`server/README.md`](./server/README.md), [`web/README.md`](./web/README.md)).

## Démarrage rapide (Docker)

```bash
docker compose up --build
```

Cela démarre PostgreSQL, Redis, l'API (`http://localhost:4000`) et l'app web
(`http://localhost:4173`).

## Démarrage rapide (sans Docker)

```bash
# Backend
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate   # nécessite une instance PostgreSQL locale
npm run dev

# Frontend (dans un autre terminal)
cd web
cp .env.example .env
npm install
npm run dev
```

## Roadmap d'implémentation

- **Phase 1 (MVP, en cours)** : Auth + Profils + Matching de base + Messagerie
  (catégorie Amical opérationnelle, les 4 autres sont sélectionnables et déjà
  supportées par le modèle de données et l'API).
- **Phase 2** : Fonctionnalités spécifiques par catégorie (questionnaires de
  compatibilité pour Amoureux/Mariage, vérification d'identité renforcée pour
  Sans Lendemain/Mariage, portfolio pour Professionnel).
- **Phase 3** : Système de paiement + abonnements Premium (Gold/Platinum/Diamond).
- **Phase 4** : Application mobile (React Native/Expo) + Événements.
- **Phase 5** : IA/ML pour le matching + fonctionnalités sociales (Stories, groupes).

## Stack technique

| Domaine       | Technologie                                   |
| ------------- | ---------------------------------------------- |
| Frontend Web  | React + TypeScript + Tailwind CSS (Vite)       |
| Backend       | Node.js/Express + Socket.io                     |
| Base de données | PostgreSQL + Prisma ORM                       |
| Authentification | JWT                                          |
| Temps réel    | Socket.io                                       |
| DevOps        | Docker + Docker Compose                         |

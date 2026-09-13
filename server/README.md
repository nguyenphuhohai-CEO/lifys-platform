# Lifys API Server

Backend for **Lifys**, the multi-category dating platform (Amical, Amoureux, Sans Lendemain,
Mariage, Professionnel).

## Stack

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- JWT authentication
- Socket.io for real-time messaging

## Getting Started

```bash
cp .env.example .env   # update DATABASE_URL and JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate   # requires a running PostgreSQL instance
npm run dev
```

The server listens on `PORT` (default `4000`) and exposes a health check at `GET /health`.

## API Overview

| Method | Path                                | Description                                  |
| ------ | ----------------------------------- | --------------------------------------------- |
| POST   | `/auth/register`                    | Multi-step registration (categories 1-5)      |
| POST   | `/auth/login`                       | Login, returns access + refresh tokens        |
| POST   | `/auth/refresh-token`                | Exchange a refresh token for a new access one |
| GET    | `/users/:id`                        | Get a public profile                          |
| PUT    | `/users/:id/profile`                | Update your own profile                       |
| POST   | `/users/:id/photos`                 | Add a photo (max 10)                          |
| GET    | `/users/:id/matches`                | List your matches                             |
| POST   | `/users/:id/block/:blockedId`       | Block another user                            |
| GET    | `/discover?category=...`            | Discover candidates for a category            |
| POST   | `/likes/:userId`                    | Like a user (creates a match on reciprocity)  |
| POST   | `/super-likes/:userId`              | Super-like a user                             |
| GET    | `/matches?category=...`             | List matches, optionally filtered by category |
| GET    | `/messages/:conversationId`         | Get message history for a match               |
| POST   | `/messages/:conversationId`         | Send a message                                |
| GET    | `/events?category=...&location=...` | List upcoming events                          |
| POST   | `/events`                           | Create an event                               |
| POST   | `/events/:id/rsvp`                  | RSVP to an event                              |

Real-time messaging is also available over Socket.io (`send-message`, `typing`,
`join-conversation`, `new-message` events), authenticated via a JWT passed as
`socket.handshake.auth.token`.

## Data Model

The Prisma schema (`prisma/schema.prisma`) models users, per-category profiles, likes,
matches, messages, events/attendees, blocks and reports across the 5 dating categories
(`AMICAL`, `AMOUREUX`, `SANS_LENDEMAIN`, `MARIAGE`, `PROFESSIONNEL`).

## Tests

```bash
npm test
```

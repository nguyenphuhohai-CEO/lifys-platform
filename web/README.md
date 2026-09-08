# Lifys Web App

Frontend for **Lifys**, the multi-category dating platform (Amical, Amoureux, Sans Lendemain,
Mariage, Professionnel).

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Socket.io client for real-time messaging

## Getting Started

```bash
cp .env.example .env   # set VITE_API_URL to point at the backend (see ../server)
npm install
npm run dev
```

## Pages

- `/` — Landing page presenting the 5 categories
- `/login`, `/register` — Auth (registration includes selecting 1-5 categories)
- `/discover` — Category-filtered discovery with Like / Super Like / Pass
- `/matches` — List of mutual matches
- `/messages/:conversationId` — Real-time chat for a match

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run oxlint

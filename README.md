# Lifys Platform (MVP local)

Lifys est un MVP **front-end local** (React + Vite) qui simule une application de rencontres/networking pour 5 catégories : **Amical, Amoureux, Sans lendemain, Mariage, Professionnel**.

## Aperçu

Le produit propose une expérience premium, sobre et responsive avec :

- landing page + navigation multi-sections
- sélecteur de catégorie et filtres de découverte
- cartes profils avec actions Like/Pass accessibles
- matchs simulés et passerelle vers la messagerie
- messagerie locale avec sélection de conversation et envoi via Entrée
- édition de profil avec validation accessible
- notifications non bloquantes (sans `alert()`)
- persistance locale robuste via `localStorage` (fallback si JSON corrompu)
- réinitialisation complète du prototype

## Avertissement MVP local

- Données **locales/simulées** uniquement (navigateur + `localStorage`)
- Aucun backend réel
- Aucune authentification réelle
- Aucune base de données distante
- Aucune messagerie temps réel WebSocket en production
- Aucun paiement ni vérification d’identité

Ne pas utiliser ce MVP pour des données sensibles.

## Installation

```bash
npm install
npm run dev -- --host
```

## Scripts

- `npm run dev` : lance l’app en développement
- `npm run build` : build de production Vite
- `npm run preview` : prévisualise le build
- `npm run test` : exécute les tests unitaires Vitest

## Fonctionnalités

### Landing / Navigation
- Navigation desktop + mobile (menu)
- États hover/active/focus et navigation clavier
- Respect de `prefers-reduced-motion`

### Découverte
- Filtres par catégorie
- Recherche texte (nom/bio/intérêts)
- Filtre ville
- Compteur de profils
- États loading / empty / error

### Profil
- Formulaire contrôlé
- Validation accessible (messages d’erreur par champ)
- Formatage des intérêts
- Fallback avatar (initiales)

### Matchs
- Liste des correspondances simulées
- Action directe vers la messagerie

### Messages
- Sélection de conversation
- État vide explicite
- Envoi avec la touche Entrée
- Persistance locale

## Architecture (front-end)

- `src/App.jsx` : orchestration des vues, états et UX
- `src/styles.css` : thème UI responsive et accessibilité visuelle
- `src/utils/storage.js` : lecture/écriture locale sécurisée
- `src/utils/matching.js` : logique de filtrage et matching
- `src/utils/format.js` : formatage intérêts + fallback avatar
- `src/utils/*.test.js` : tests unitaires ciblés

## Limites actuelles

Ce dépôt reste un prototype local orienté démonstration UX. Les données sont fictives et non vérifiées.

## Roadmap recommandée (phase production)

1. **Backend/API** : Node.js/Express (ou équivalent), validation serveur
2. **Auth** : comptes utilisateurs, gestion session/token
3. **Base de données** : persistance profils/likes/matchs/messages
4. **WebSocket** : messagerie temps réel fiable
5. **Sécurité** : chiffrement, protections anti-abus, conformité RGPD

## Vérifications réalisées

- `npm run test`
- `npm run build`


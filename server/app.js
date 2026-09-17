import fs from 'node:fs';
import path from 'node:path';

import express from 'express';

import {
  comparePassword,
  createToken,
  hashPassword,
  normalizeEmail,
  validateEmail,
  validatePassword,
  verifyToken,
} from './auth.js';
import { createDatabase, sanitizeProfileInput } from './db.js';

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function sendSession(res, token, profile) {
  res.json({
    token,
    user: {
      email: profile.email,
      profile,
    },
  });
}

export function createApp(config) {
  const database = createDatabase(config.databaseFile);
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  function requireAuth(req, _res, next) {
    const authorization = req.headers.authorization ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';

    if (!token) {
      next(createHttpError(401, 'Authentification requise.'));
      return;
    }

    try {
      const payload = verifyToken(token, config);
      const profile = database.getProfileByUserId(payload.userId);

      if (!profile) {
        next(createHttpError(401, 'Session introuvable.'));
        return;
      }

      req.auth = { token, userId: payload.userId, email: payload.email, profile };
      next();
    } catch {
      next(createHttpError(401, 'Session expirée ou invalide.'));
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      const password = req.body.password;
      const initialProfile = sanitizeProfileInput({
        name: req.body.name || email.split('@')[0] || 'Profil Lifys',
        mode: req.body.mode,
      });

      if (!validateEmail(email)) {
        throw createHttpError(400, 'Adresse e-mail invalide.');
      }

      if (!validatePassword(password)) {
        throw createHttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
      }

      if (database.getUserByEmail(email)) {
        throw createHttpError(409, 'Un compte existe déjà avec cet e-mail.');
      }

      const created = database.createUser({
        email,
        passwordHash: hashPassword(password),
        name: initialProfile.name || 'Profil Lifys',
        mode: initialProfile.mode,
      });
      const token = createToken({ userId: created.userId, email }, config);
      res.status(201);
      sendSession(res, token, created.profile);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      const email = normalizeEmail(req.body.email);
      const password = req.body.password;
      const user = database.getUserByEmail(email);

      if (!user || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Identifiants invalides.');
      }

      const token = createToken({ userId: user.id, email }, config);
      sendSession(res, token, database.getProfileByUserId(user.id));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/auth/session', requireAuth, (req, res) => {
    sendSession(res, req.auth.token, database.getProfileByUserId(req.auth.userId));
  });

  app.get('/api/bootstrap', requireAuth, (req, res) => {
    res.json({
      profile: database.getProfileByUserId(req.auth.userId),
      matches: database.listMatchesForUser(req.auth.userId),
      conversations: database.listConversationsForUser(req.auth.userId),
    });
  });

  app.get('/api/profile', requireAuth, (req, res) => {
    res.json({ profile: database.getProfileByUserId(req.auth.userId) });
  });

  app.put('/api/profile', requireAuth, (req, res, next) => {
    try {
      const profile = sanitizeProfileInput(req.body);

      if (!profile.name || !profile.city || !profile.bio || !profile.age) {
        throw createHttpError(400, 'Nom, âge, ville et bio sont requis.');
      }

      res.json({ profile: database.updateUserProfile(req.auth.userId, profile) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/discovery', requireAuth, (req, res) => {
    res.json({
      profiles: database.listDiscoveryProfiles(req.auth.userId, {
        activeMode: req.query.mode ?? 'all',
        query: req.query.query ?? '',
        city: req.query.city ?? '',
      }),
    });
  });

  app.post('/api/interactions/like', requireAuth, (req, res, next) => {
    try {
      if (!req.body.profileId) {
        throw createHttpError(400, 'profileId est requis.');
      }

      res.json(database.likeProfile(req.auth.userId, req.body.profileId));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interactions/pass', requireAuth, (req, res, next) => {
    try {
      if (!req.body.profileId) {
        throw createHttpError(400, 'profileId est requis.');
      }

      if (!database.passProfile(req.auth.userId, req.body.profileId)) {
        throw createHttpError(404, 'Profil introuvable.');
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/matches', requireAuth, (req, res) => {
    res.json({ matches: database.listMatchesForUser(req.auth.userId) });
  });

  app.get('/api/conversations', requireAuth, (req, res) => {
    res.json({ conversations: database.listConversationsForUser(req.auth.userId) });
  });

  app.post('/api/conversations/:conversationId/messages', requireAuth, (req, res, next) => {
    try {
      const text = `${req.body.text ?? ''}`.trim();

      if (!text) {
        throw createHttpError(400, 'Le message est vide.');
      }

      const conversation = database.addMessage(req.auth.userId, req.params.conversationId, text);
      if (!conversation) {
        throw createHttpError(404, 'Conversation introuvable.');
      }

      res.status(201).json({ conversation });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/prototype/reset', requireAuth, (req, res) => {
    database.resetUserData(req.auth.userId);
    res.json({
      profile: database.getProfileByUserId(req.auth.userId),
      matches: database.listMatchesForUser(req.auth.userId),
      conversations: database.listConversationsForUser(req.auth.userId),
    });
  });

  if (fs.existsSync(config.staticDir)) {
    app.use(express.static(config.staticDir));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(path.join(config.staticDir, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      error: error.message || 'Une erreur inattendue est survenue.',
    });
  });

  return { app, database };
}

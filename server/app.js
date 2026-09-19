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

function createHttpError(status, message, code = 'REQUEST_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

function readRequiredString(body, field, { maxLength = 200 } = {}) {
  const value = `${body[field] ?? ''}`.trim();
  if (!value) {
    throw createHttpError(400, `${field} est requis.`, 'VALIDATION_ERROR');
  }

  if (value.length > maxLength) {
    throw createHttpError(400, `${field} dépasse la longueur maximale autorisée.`, 'VALIDATION_ERROR');
  }

  return value;
}

function readOptionalString(body, field, { maxLength = 2000 } = {}) {
  const value = `${body[field] ?? ''}`.trim();
  if (!value) {
    return '';
  }

  if (value.length > maxLength) {
    throw createHttpError(400, `${field} dépasse la longueur maximale autorisée.`, 'VALIDATION_ERROR');
  }

  return value;
}

function getRequestIp(req) {
  const forwarded = `${req.headers['x-forwarded-for'] ?? ''}`.split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'local';
}

function createRateLimiter({ windowMs, max, keyGenerator }) {
  const hits = new Map();

  return (req, res, next) => {
    if (!Number.isFinite(windowMs) || windowMs <= 0 || !Number.isFinite(max) || max <= 0) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      next(createHttpError(429, 'Trop de requêtes, réessayez plus tard.', 'RATE_LIMITED'));
      return;
    }

    next();
  };
}

function parseCorsOrigins(corsOrigin) {
  return `${corsOrigin ?? ''}`
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
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
  const allowedOrigins = parseCorsOrigins(config.corsOrigin);
  const authRateLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.authRateLimitMax,
    keyGenerator: (req) => `auth:${getRequestIp(req)}`,
  });
  const writeRateLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.writeRateLimitMax,
    keyGenerator: (req) => `write:${req.auth?.userId ?? getRequestIp(req)}`,
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use((error, _req, res, next) => {
    if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: 'Corps JSON invalide.', code: 'INVALID_JSON' });
      return;
    }

    next(error);
  });
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');

    if (allowedOrigins.length > 0) {
      const requestOrigin = `${req.headers.origin ?? ''}`.trim();
      const allowAll = allowedOrigins.includes('*');
      if (allowAll || allowedOrigins.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : requestOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  function requireAuth(req, _res, next) {
    const authorization = req.headers.authorization ?? '';
    const isBearerToken = authorization.startsWith('Bearer ');
    const token = isBearerToken ? authorization.slice(7) : '';

    if (!authorization) {
      next(createHttpError(401, 'Authentification requise.', 'AUTH_REQUIRED'));
      return;
    }

    if (!isBearerToken || !token) {
      next(createHttpError(401, 'Session expirée ou invalide.', 'SESSION_INVALID'));
      return;
    }

    try {
      const payload = verifyToken(token, config);
      const profile = database.getProfileByUserId(payload.userId);

      if (!profile) {
        next(createHttpError(401, 'Session introuvable.', 'SESSION_NOT_FOUND'));
        return;
      }

      req.auth = { token, userId: payload.userId, email: payload.email, profile };
      next();
    } catch {
      next(createHttpError(401, 'Session expirée ou invalide.', 'SESSION_INVALID'));
    }
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', authRateLimiter, (req, res, next) => {
    try {
      const body = normalizeBody(req.body);
      const email = normalizeEmail(body.email);
      const password = readRequiredString(body, 'password', { maxLength: 200 });
      const initialProfile = sanitizeProfileInput({
        name: body.name || email.split('@')[0] || 'Profil Lifys',
        mode: body.mode,
      });

      if (!validateEmail(email)) {
        throw createHttpError(400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');
      }

      if (!validatePassword(password)) {
        throw createHttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.', 'INVALID_PASSWORD');
      }

      if (database.getUserByEmail(email)) {
        throw createHttpError(409, 'Un compte existe déjà avec cet e-mail.', 'EMAIL_ALREADY_EXISTS');
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

  app.post('/api/auth/login', authRateLimiter, (req, res, next) => {
    try {
      const body = normalizeBody(req.body);
      const email = normalizeEmail(body.email);
      const password = readOptionalString(body, 'password', { maxLength: 200 });
      const user = database.getUserByEmail(email);

      if (typeof password !== 'string' || !password || !user || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Identifiants invalides.', 'INVALID_CREDENTIALS');
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

  app.put('/api/profile', requireAuth, writeRateLimiter, (req, res, next) => {
    try {
      const profile = sanitizeProfileInput(normalizeBody(req.body));

      if (!profile.name || !profile.city || !profile.bio || !profile.age) {
        throw createHttpError(400, 'Nom, âge, ville et bio sont requis.', 'PROFILE_INCOMPLETE');
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

  app.post('/api/interactions/like', requireAuth, writeRateLimiter, (req, res, next) => {
    try {
      const body = normalizeBody(req.body);
      const profileId = readRequiredString(body, 'profileId', { maxLength: 80 });

      if (!profileId) {
        throw createHttpError(400, 'profileId est requis.', 'PROFILE_ID_REQUIRED');
      }

      res.json(database.likeProfile(req.auth.userId, profileId));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interactions/pass', requireAuth, writeRateLimiter, (req, res, next) => {
    try {
      const body = normalizeBody(req.body);
      const profileId = readRequiredString(body, 'profileId', { maxLength: 80 });

      if (!profileId) {
        throw createHttpError(400, 'profileId est requis.', 'PROFILE_ID_REQUIRED');
      }

      if (!database.passProfile(req.auth.userId, profileId)) {
        throw createHttpError(404, 'Profil introuvable.', 'PROFILE_NOT_FOUND');
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

  app.post('/api/conversations/:conversationId/messages', requireAuth, writeRateLimiter, (req, res, next) => {
    try {
      const body = normalizeBody(req.body);
      const text = readRequiredString(body, 'text', { maxLength: 2000 });

      if (!text) {
        throw createHttpError(400, 'Le message est vide.', 'MESSAGE_EMPTY');
      }

      const conversation = database.addMessage(req.auth.userId, req.params.conversationId, text);
      if (!conversation) {
        throw createHttpError(404, 'Conversation introuvable.', 'CONVERSATION_NOT_FOUND');
      }

      res.status(201).json({ conversation });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/prototype/reset', requireAuth, writeRateLimiter, (req, res) => {
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
    if ((error.status || 500) >= 500) {
      console.error('[lifys-api]', error);
    }

    res.status(error.status || 500).json({
      error: error.message || 'Une erreur inattendue est survenue.',
      code: error.code || 'INTERNAL_ERROR',
    });
  });

  return { app, database };
}

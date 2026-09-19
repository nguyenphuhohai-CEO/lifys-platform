import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import express from 'express';
import { rateLimit } from 'express-rate-limit';

import { verifyToken } from './auth.js';
import { createAuthController } from './controllers/auth-controller.js';
import { createDatabase, sanitizeProfileInput } from './db.js';
import { createHttpError } from './http.js';
import { createAuthService } from './services/auth-service.js';
import { normalizeBody, readRequiredString } from './validation.js';

function getRequestIp(req) {
  return req.ip || req.socket.remoteAddress || 'local';
}

function hashIdentifier(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createApiRateLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    legacyHeaders: false,
    standardHeaders: 'draft-7',
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({
        error: 'Trop de requêtes, réessayez plus tard.',
        code: 'RATE_LIMITED',
      });
    },
  });
}

function parseCorsOrigins(corsOrigin) {
  return `${corsOrigin ?? ''}`
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function extractRequestOrigin(req) {
  const origin = `${req.headers.origin ?? ''}`.trim();
  if (origin) {
    return origin;
  }

  const referer = `${req.headers.referer ?? ''}`.trim();
  if (!referer) {
    return '';
  }

  try {
    return new URL(referer).origin;
  } catch {
    return '';
  }
}

function getCookieValue(req, cookieName) {
  const rawCookies = `${req.headers.cookie ?? ''}`;
  if (!rawCookies) {
    return '';
  }

  return rawCookies
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) ?? '';
}

export function createApp(config) {
  const database = createDatabase(config.databaseFile);
  const authService = createAuthService({ database, config });
  const authController = createAuthController({ authService, config });
  const app = express();
  const allowedOrigins = parseCorsOrigins(config.corsOrigin);
  const authRateLimiter = createApiRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.authRateLimitMax,
    keyGenerator: (req) => `auth:${getRequestIp(req)}`,
  });
  const protectedRouteRateLimiter = createApiRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.writeRateLimitMax,
    keyGenerator: (req) => {
      const authorization = `${req.headers.authorization ?? ''}`.trim();
      return authorization
        ? `protected:${hashIdentifier(authorization)}`
        : `protected-ip:${getRequestIp(req)}`;
    },
  });
  const refreshCookieRateLimiter = createApiRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.writeRateLimitMax,
    keyGenerator: (req) => `refresh-ip:${getRequestIp(req)}`,
  });
  const writeRateLimiter = createApiRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.writeRateLimitMax,
    keyGenerator: (req) => `write-user:${req.auth.userId}`,
  });
  const requireTrustedCookieOrigin = (req, _res, next) => {
    const requestOrigin = extractRequestOrigin(req);
    const trustedOrigins = allowedOrigins.length > 0
      ? allowedOrigins
      : [`${req.protocol}://${req.get('host')}`];

    if (!requestOrigin || !trustedOrigins.includes(requestOrigin)) {
      next(createHttpError(403, 'Origine non autorisée pour ce cookie sécurisé.', 'TRUSTED_ORIGIN_REQUIRED'));
      return;
    }

    next();
  };
  const requireMatchingCsrfToken = (req, _res, next) => {
    const cookieToken = decodeURIComponent(getCookieValue(req, config.csrfCookieName));
    const headerToken = `${req.headers['x-csrf-token'] ?? ''}`.trim();

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      next(createHttpError(403, 'Jeton CSRF invalide.', 'CSRF_TOKEN_INVALID'));
      return;
    }

    next();
  };

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
    const requestOrigin = `${req.headers.origin ?? ''}`.trim();
    const allowAll = allowedOrigins.includes('*');
    const allowedOrigin = allowAll
      ? '*'
      : (requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : '');

    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      if (!allowAll) {
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      if (allowedOrigins.length === 0 && requestOrigin) {
        next(createHttpError(403, 'Origine non autorisée.', 'CORS_ORIGIN_DENIED'));
        return;
      }

      if (allowedOrigins.length > 0 && !allowedOrigin) {
        next(createHttpError(403, 'Origine non autorisée.', 'CORS_ORIGIN_DENIED'));
        return;
      }

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

  app.post('/api/auth/register', authRateLimiter, authController.register);

  app.post('/api/auth/login', authRateLimiter, authController.login);
  app.post('/api/auth/refresh', authRateLimiter, refreshCookieRateLimiter, requireTrustedCookieOrigin, requireMatchingCsrfToken, authController.requireRefreshCookie, authController.refresh);
  app.post('/api/auth/logout', refreshCookieRateLimiter, requireTrustedCookieOrigin, requireMatchingCsrfToken, authController.logout);
  app.get('/api/auth/session', protectedRouteRateLimiter, requireAuth, authController.session);
  app.post('/api/auth/verify-email/request', protectedRouteRateLimiter, requireAuth, writeRateLimiter, authController.requestEmailVerification);
  app.post('/api/auth/verify-email/confirm', authRateLimiter, authController.verifyEmail);
  app.post('/api/auth/password-reset/request', authRateLimiter, authController.requestPasswordReset);
  app.post('/api/auth/password-reset/confirm', authRateLimiter, authController.resetPassword);

  app.get('/api/bootstrap', protectedRouteRateLimiter, requireAuth, (req, res) => {
    res.json({
      profile: database.getProfileByUserId(req.auth.userId),
      matches: database.listMatchesForUser(req.auth.userId),
      conversations: database.listConversationsForUser(req.auth.userId),
    });
  });

  app.get('/api/profile', protectedRouteRateLimiter, requireAuth, (req, res) => {
    res.json({ profile: database.getProfileByUserId(req.auth.userId) });
  });

  app.put('/api/profile', protectedRouteRateLimiter, requireAuth, writeRateLimiter, (req, res, next) => {
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

  app.get('/api/discovery', protectedRouteRateLimiter, requireAuth, (req, res) => {
    res.json({
      profiles: database.listDiscoveryProfiles(req.auth.userId, {
        activeMode: req.query.mode ?? 'all',
        query: req.query.query ?? '',
        city: req.query.city ?? '',
      }),
    });
  });

  app.post('/api/interactions/like', protectedRouteRateLimiter, requireAuth, writeRateLimiter, (req, res, next) => {
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

  app.post('/api/interactions/pass', protectedRouteRateLimiter, requireAuth, writeRateLimiter, (req, res, next) => {
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

  app.get('/api/matches', protectedRouteRateLimiter, requireAuth, (req, res) => {
    res.json({ matches: database.listMatchesForUser(req.auth.userId) });
  });

  app.get('/api/conversations', protectedRouteRateLimiter, requireAuth, (req, res) => {
    res.json({ conversations: database.listConversationsForUser(req.auth.userId) });
  });

  app.post('/api/conversations/:conversationId/messages', protectedRouteRateLimiter, requireAuth, writeRateLimiter, (req, res, next) => {
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

  app.post('/api/prototype/reset', protectedRouteRateLimiter, requireAuth, writeRateLimiter, (req, res) => {
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

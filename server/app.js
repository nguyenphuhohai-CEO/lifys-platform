import crypto from 'node:crypto';
import fs from 'node:fs';

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
import { applyStripeEvent, createCheckoutSession, createPortalSession, getPlans, verifyStripeSignature } from './billing.js';
import { buildVerificationEmail } from './email-templates.js';
import { createMailer } from './mailer.js';
import { createRateLimiter } from './rate-limit.js';

export const TERMS_VERSION = '2026-10-18';
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const REPORT_REASONS = new Set(['spam', 'harcelement', 'faux-profil', 'contenu-inapproprie', 'mineur', 'autre']);

function createHttpError(status, message, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sendSession(res, token, profile) {
  res.json({
    token,
    user: {
      email: profile.email,
      emailVerified: profile.emailVerified,
      profile,
    },
  });
}

export function createApp(config) {
  const database = createDatabase(config.databaseFile, {
    seedDemoData: config.seedDemoData,
    requireEmailVerification: config.requireEmailVerification,
  });
  const mailer = createMailer(config);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.post('/api/billing/webhook', express.raw({ type: '*/*', limit: '100kb' }), (req, res, next) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      if (!verifyStripeSignature(rawBody, req.headers['stripe-signature'], config.billing.webhookSecret)) {
        throw createHttpError(400, 'Signature invalide.');
      }

      applyStripeEvent(database, JSON.parse(rawBody));
      res.json({ received: true });
    } catch (error) {
      next(error);
    }
  });

  app.use(express.json({ limit: '100kb' }));
  const adsEnabled = Boolean(config.ads?.client);
  const csp = adsEnabled
    ? "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google; connect-src 'self' https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google; frame-src https://*.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    : "default-src 'self'; img-src 'self' data: https://images.unsplash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', csp);
    if (config.nodeEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  });

  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: config.nodeEnv === 'test' ? 1000 : 30,
    message: 'Trop de tentatives. Réessayez dans quelques minutes.',
  });
  app.use('/api/auth', authLimiter);

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

      if (database.getUserById(payload.userId)?.status !== 'active') {
        next(createHttpError(403, 'Ce compte est suspendu.', 'account_suspended'));
        return;
      }

      req.auth = { token, userId: payload.userId, email: payload.email, profile };
      next();
    } catch {
      next(createHttpError(401, 'Session expirée ou invalide.'));
    }
  }

  function requireVerified(req, _res, next) {
    if (config.requireEmailVerification && !req.auth.profile.emailVerified) {
      next(createHttpError(403, 'Vérifiez votre adresse e-mail pour utiliser cette fonctionnalité.', 'email_not_verified'));
      return;
    }

    next();
  }

  function requireAdmin(req, _res, next) {
    if (!config.adminEmails.includes(req.auth.profile.email)) {
      next(createHttpError(403, 'Accès réservé aux administrateurs.'));
      return;
    }

    next();
  }

  async function sendVerificationEmail(userId, email, lang) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    database.createEmailVerification(userId, hashToken(rawToken), new Date(Date.now() + VERIFICATION_TTL_MS).toISOString());

    const message = buildVerificationEmail(lang, `${config.appUrl}/verify-email?token=${rawToken}`);
    await mailer.send({ to: email, ...message });
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/auth/register', async (req, res, next) => {
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

      if (req.body.acceptTerms !== true) {
        throw createHttpError(400, 'Vous devez accepter les CGU et confirmer avoir au moins 18 ans.');
      }

      if (database.getUserByEmail(email)) {
        throw createHttpError(409, 'Un compte existe déjà avec cet e-mail.');
      }

      const created = database.createUser({
        email,
        passwordHash: hashPassword(password),
        name: initialProfile.name || 'Profil Lifys',
        mode: initialProfile.mode,
        termsVersion: TERMS_VERSION,
      });

      if (config.requireEmailVerification) {
        try {
          await sendVerificationEmail(created.userId, email, req.body.lang);
        } catch (mailError) {
          console.error('Verification e-mail failed:', mailError.message);
        }
      }

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

      if (typeof password !== 'string' || !password || !user || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Identifiants invalides.');
      }

      if (user.status !== 'active') {
        throw createHttpError(403, 'Ce compte est suspendu.', 'account_suspended');
      }

      const token = createToken({ userId: user.id, email }, config);
      sendSession(res, token, database.getProfileByUserId(user.id));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/verify-email', (req, res, next) => {
    try {
      const rawToken = `${req.body.token ?? ''}`;
      const userId = rawToken ? database.verifyEmailToken(hashToken(rawToken)) : null;

      if (!userId) {
        throw createHttpError(400, 'Lien de confirmation invalide ou expiré.');
      }

      res.json({ verified: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/resend-verification', requireAuth, async (req, res, next) => {
    try {
      if (req.auth.profile.emailVerified) {
        res.json({ sent: false, alreadyVerified: true });
        return;
      }

      await sendVerificationEmail(req.auth.userId, req.auth.profile.email, req.body?.lang);
      res.json({ sent: true });
    } catch (error) {
      next(error);
    }
  });

  const billingConfigured = () => Boolean(config.billing.secretKey && config.billing.premiumPriceId);

  app.get('/api/billing/plans', (_req, res) => {
    res.json({ plans: getPlans(config), checkoutAvailable: billingConfigured(),
      ads: adsEnabled ? { client: config.ads.client, slot: config.ads.slot } : null,
    });
  });

  app.post('/api/billing/checkout', requireAuth, requireVerified, async (req, res, next) => {
    try {
      if (!billingConfigured()) {
        throw createHttpError(503, 'Le paiement n’est pas encore disponible.', 'billing_unavailable');
      }

      if (req.auth.profile.plan === 'premium') {
        throw createHttpError(409, 'Vous êtes déjà abonné à Lifys Premium.');
      }

      const user = database.getUserById(req.auth.userId);
      const url = await createCheckoutSession(config, { userId: req.auth.userId, email: req.auth.profile.email, customerId: user.stripe_customer_id });
      res.json({ url });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/billing/portal', requireAuth, async (req, res, next) => {
    try {
      const user = database.getUserById(req.auth.userId);
      if (!billingConfigured() || !user.stripe_customer_id) {
        throw createHttpError(503, 'La gestion de l’abonnement n’est pas disponible.', 'billing_unavailable');
      }

      res.json({ url: await createPortalSession(config, user.stripe_customer_id) });
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

  app.get('/api/discovery', requireAuth, requireVerified, (req, res) => {
    res.json({
      profiles: database.listDiscoveryProfiles(req.auth.userId, {
        activeMode: req.query.mode ?? 'all',
        query: req.query.query ?? '',
        city: req.query.city ?? '',
      }),
    });
  });

  app.post('/api/interactions/like', requireAuth, requireVerified, (req, res, next) => {
    try {
      if (!req.body.profileId) {
        throw createHttpError(400, 'profileId est requis.');
      }

      res.json(database.likeProfile(req.auth.userId, req.body.profileId));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/interactions/pass', requireAuth, requireVerified, (req, res, next) => {
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

  app.post('/api/conversations/:conversationId/messages', requireAuth, requireVerified, (req, res, next) => {
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

  app.post('/api/reports', requireAuth, (req, res, next) => {
    try {
      const reason = `${req.body.reason ?? ''}`;
      if (!req.body.profileId || !REPORT_REASONS.has(reason)) {
        throw createHttpError(400, 'Profil et motif valides requis.');
      }

      const details = `${req.body.details ?? ''}`.trim().slice(0, 1000);
      if (!database.reportProfile(req.auth.userId, req.body.profileId, { reason, details })) {
        throw createHttpError(404, 'Profil introuvable.');
      }

      res.status(201).json({ reported: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/blocks', requireAuth, (req, res, next) => {
    try {
      if (!req.body.profileId || !database.blockProfile(req.auth.userId, req.body.profileId)) {
        throw createHttpError(404, 'Profil introuvable.');
      }

      res.status(201).json({ blocked: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/reports', requireAuth, requireAdmin, (_req, res) => {
    res.json({ reports: database.listOpenReports() });
  });

  app.post('/api/admin/reports/:reportId/resolve', requireAuth, requireAdmin, (req, res, next) => {
    try {
      const action = req.body.action;
      if (!['dismiss', 'suspend'].includes(action) || !database.resolveReportById(req.params.reportId, action)) {
        throw createHttpError(400, 'Signalement introuvable ou action invalide.');
      }

      res.json({ resolved: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/account/export', requireAuth, (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="lifys-donnees.json"');
    res.json(database.exportUserData(req.auth.userId));
  });

  app.delete('/api/account', requireAuth, (req, res, next) => {
    try {
      const user = database.getUserById(req.auth.userId);
      const password = req.body?.password;
      if (typeof password !== 'string' || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Mot de passe incorrect.');
      }

      database.deleteAccount(req.auth.userId);
      res.status(204).end();
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
      res.sendFile('index.html', { root: config.staticDir });
    });
  }

  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      error: error.message || 'Une erreur inattendue est survenue.',
      ...(error.code ? { code: error.code } : {}),
    });
  });

  return { app, database, mailer };
}


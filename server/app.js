import crypto from 'node:crypto';
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
import { applyStripeEvent, createCheckoutSession, createPortalSession, getPlans, verifyStripeSignature } from './billing.js';
import { buildVerificationEmail } from './email-templates.js';
import { createMailer } from './mailer.js';
import { createOAuth, OAUTH_COOKIE, readCookie } from './oauth.js';
import { createRateLimiter } from './rate-limit.js';
import { createSelfieStore, createUploadStore, detectImageType, MAX_UPLOAD_BYTES, ownUploadPattern, UPLOAD_MIME_TYPES } from './uploads.js';

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
      isAdmin: (res.app.locals.adminEmails ?? []).includes(profile.email),
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
  const uploads = createUploadStore(config.uploadDir);
  const selfies = createSelfieStore(`${config.uploadDir.replace(/[\\/]+$/, '')}-selfies`);
  const app = express();

  app.disable('x-powered-by');
  app.locals.adminEmails = config.adminEmails;
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

  // Déploiement dédié à un seul site : le site est imposé côté serveur.
  app.get('/api/site', (_req, res) => {
    res.json({ siteOnly: config.siteOnly || null });
  });
  app.use('/api', (req, res, next) => {
    if (!config.siteOnly) {
      next();
      return;
    }
    if (req.path === '/auth/switch-site' && req.body?.site !== config.siteOnly) {
      next(createHttpError(403, 'Ce site est indépendant des autres sites Lifys.'));
      return;
    }
    if (req.body && typeof req.body === 'object') {
      if ('mode' in req.body || req.path === '/auth/register' || req.path === '/profile') req.body.mode = config.siteOnly;
      if (req.path === '/auth/login' || req.path === '/auth/switch-site') req.body.site = config.siteOnly;
    }
    if (req.query.site) req.query.site = config.siteOnly;
    if (req.query.mode && req.query.mode !== 'all') req.query.mode = config.siteOnly;
    next();
  });
  const adsEnabled = Boolean(config.ads?.client);
  const analyticsId = config.analyticsId || '';
  const gaScript = analyticsId ? ' https://www.googletagmanager.com' : '';
  const gaConnect = analyticsId ? ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com' : '';
  const gaImg = analyticsId ? ' https://*.google-analytics.com https://*.googletagmanager.com' : '';
  const csp = adsEnabled
    ? `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.adtrafficquality.google${gaScript}; connect-src 'self' https://*.googlesyndication.com https://*.google.com https://*.adtrafficquality.google${gaConnect}; frame-src https://*.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
    : `default-src 'self'; img-src 'self' data: https://images.unsplash.com${gaImg}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'${gaScript}; connect-src 'self'${gaConnect}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
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
  const uploadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: config.nodeEnv === 'test' ? 1000 : 30,
    message: 'Trop d’envois de photos. Réessayez plus tard.',
  });
  app.use('/uploads', express.static(uploads.directory, {
    index: false,
    dotfiles: 'ignore',
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  }));

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

      const account = database.getAccountByEmail(email);
      if (account) {
        if (database.getUserByEmail(email, initialProfile.mode) || !comparePassword(password, account.password_hash)) {
          throw createHttpError(409, 'Un compte existe déjà avec cet e-mail.');
        }
        if (account.status !== 'active') {
          throw createHttpError(403, 'Ce compte est suspendu.', 'account_suspended');
        }
        const joined = database.joinSite(account, initialProfile.mode, initialProfile.name || 'Profil Lifys');
        res.status(201);
        sendSession(res, createToken({ userId: joined.id, email }, config), database.getProfileByUserId(joined.id));
        return;
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
      const site = sanitizeProfileInput({ mode: req.body.site ?? req.body.mode }).mode;
      const account = database.getAccountByEmail(email);

      if (typeof password !== 'string' || !password || !account || !comparePassword(password, account.password_hash)) {
        throw createHttpError(401, 'Identifiants invalides.');
      }

      const user = database.getUserByEmail(email, site)
        ?? (account.status === 'active' ? database.joinSite(account, site, account.email.split('@')[0] || 'Profil Lifys') : account);

      if (user.status !== 'active') {
        throw createHttpError(403, 'Ce compte est suspendu.', 'account_suspended');
      }

      const token = createToken({ userId: user.id, email }, config);
      sendSession(res, token, database.getProfileByUserId(user.id));
    } catch (error) {
      next(error);
    }
  });

  const oauth = createOAuth(config);
  const oauthFetch = (...args) => (config.fetchImpl ?? fetch)(...args);
  const oauthFailure = (res, site, code) => {
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE}=; Path=/api/auth/oauth; Max-Age=0; HttpOnly; SameSite=Lax`);
    res.redirect(`${config.appUrl}/${site}#oauth_error=${code}`);
  };

  app.get('/api/auth/providers', (_req, res) => {
    res.json({ providers: oauth.providers() });
  });

  app.get('/api/auth/oauth/:provider', (req, res, next) => {
    const { provider } = req.params;
    if (!oauth.isEnabled(provider)) {
      next(createHttpError(404, 'Connexion indisponible.'));
      return;
    }
    const site = sanitizeProfileInput({ mode: req.query.site }).mode;
    const { state, nonce } = oauth.createState(provider, site);
    const secure = config.appUrl.startsWith('https://') ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${OAUTH_COOKIE}=${nonce}; Path=/api/auth/oauth; Max-Age=600; HttpOnly; SameSite=Lax${secure}`);
    res.redirect(oauth.authorizeUrl(provider, state));
  });

  app.get('/api/auth/oauth/:provider/callback', async (req, res, next) => {
    const { provider } = req.params;
    if (!oauth.isEnabled(provider)) {
      next(createHttpError(404, 'Connexion indisponible.'));
      return;
    }
    const state = oauth.readState(req.query.state, provider, readCookie(req, OAUTH_COOKIE));
    if (!state) {
      oauthFailure(res, 'amoureux', 'state');
      return;
    }
    const { site } = state;
    if (req.query.error || typeof req.query.code !== 'string' || !req.query.code) {
      oauthFailure(res, site, 'denied');
      return;
    }

    try {
      const identity = await oauth.fetchIdentity(provider, req.query.code, oauthFetch);
      if (!validateEmail(identity.email)) {
        oauthFailure(res, site, 'email');
        return;
      }

      const name = sanitizeProfileInput({ name: identity.name || identity.email.split('@')[0] }).name || 'Profil Lifys';
      const account = database.getAccountByEmail(identity.email);
      let userId;
      if (account) {
        if (account.status !== 'active') {
          oauthFailure(res, site, 'suspended');
          return;
        }
        userId = (database.getUserByEmail(identity.email, site) ?? database.joinSite(account, site, name)).id;
      } else {
        userId = database.createUser({
          email: identity.email,
          passwordHash: hashPassword(crypto.randomBytes(32).toString('hex')),
          name,
          mode: site,
          termsVersion: TERMS_VERSION,
        }).userId;
      }
      database.markEmailVerified(userId);

      res.setHeader('Set-Cookie', `${OAUTH_COOKIE}=; Path=/api/auth/oauth; Max-Age=0; HttpOnly; SameSite=Lax`);
      res.redirect(`${config.appUrl}/${site}#oauth_token=${createToken({ userId, email: identity.email }, config)}`);
    } catch (error) {
      console.error('OAuth login failed:', error.message);
      oauthFailure(res, site, 'failed');
    }
  });

  app.post('/api/auth/switch-site', requireAuth, (req, res, next) => {
    try {
      const site = sanitizeProfileInput({ mode: req.body.site }).mode;
      const account = database.getUserById(req.auth.userId);
      const user = database.getUserByEmail(account.email, site)
        ?? database.joinSite(account, site, req.auth.profile.name || account.email.split('@')[0]);
      sendSession(res, createToken({ userId: user.id, email: account.email }, config), database.getProfileByUserId(user.id));
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
      analytics: analyticsId ? { id: analyticsId } : null,
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

  app.get('/api/hub', requireAuth, (req, res) => {
    res.json({ sites: database.getAccountOverview(req.auth.userId) });
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
      const current = database.getProfileByUserId(req.auth.userId);
      const profile = sanitizeProfileInput({ ...req.body, mode: current?.mode ?? req.body.mode });

      if (!profile.name || !profile.city || !profile.bio || !profile.age) {
        throw createHttpError(400, 'Nom, âge, ville et bio sont requis.');
      }

      const previous = current?.avatar ?? '';
      if (profile.avatar.startsWith('/uploads/') && !ownUploadPattern(req.auth.userId).test(profile.avatar)) {
        throw createHttpError(400, 'Photo invalide.');
      }

      const updated = database.updateUserProfile(req.auth.userId, profile);
      if (previous !== profile.avatar && !(current?.photos ?? []).includes(previous)) uploads.removeByUrl(previous);
      res.json({ profile: updated });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/api/profile/photo',
    requireAuth,
    uploadLimiter,
    express.raw({ type: UPLOAD_MIME_TYPES, limit: MAX_UPLOAD_BYTES }),
    (req, res, next) => {
      try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          throw createHttpError(415, 'Envoyez une image JPEG, PNG ou WebP.');
        }
        const current = database.getProfileByUserId(req.auth.userId)?.avatar ?? '';
        if (!detectImageType(req.body)) throw createHttpError(415, 'Envoyez une image JPEG, PNG ou WebP.');
        uploads.removeAllForUser(req.auth.userId, [current, ...(database.getProfileByUserId(req.auth.userId)?.photos ?? [])]);
        const url = uploads.save(req.auth.userId, req.body);
        res.status(201).json({ url });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    '/api/profile/photos',
    requireAuth,
    uploadLimiter,
    express.raw({ type: UPLOAD_MIME_TYPES, limit: MAX_UPLOAD_BYTES }),
    (req, res, next) => {
      try {
        if (!Buffer.isBuffer(req.body) || !detectImageType(req.body)) {
          throw createHttpError(415, 'Envoyez une image JPEG, PNG ou WebP.');
        }
        if ((database.getProfileByUserId(req.auth.userId)?.photos ?? []).length >= 4) {
          throw createHttpError(409, 'Vous pouvez ajouter 4 photos supplémentaires au maximum.');
        }
        const url = uploads.save(req.auth.userId, req.body);
        res.status(201).json({ profile: database.addProfilePhoto(req.auth.userId, url) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post('/api/profile/photos/remove', requireAuth, (req, res, next) => {
    try {
      const url = `${req.body.url ?? ''}`;
      const profile = ownUploadPattern(req.auth.userId).test(url) ? database.removeProfilePhoto(req.auth.userId, url) : null;
      if (!profile) {
        throw createHttpError(404, 'Photo introuvable.');
      }
      uploads.removeByUrl(url);
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/api/profile/selfie',
    requireAuth,
    uploadLimiter,
    express.raw({ type: UPLOAD_MIME_TYPES, limit: MAX_UPLOAD_BYTES }),
    (req, res, next) => {
      try {
        if (!Buffer.isBuffer(req.body) || !detectImageType(req.body)) {
          throw createHttpError(415, 'Envoyez une image JPEG, PNG ou WebP.');
        }
        const status = database.getProfileByUserId(req.auth.userId)?.selfieStatus;
        if (status === 'approved' || status === 'pending') {
          throw createHttpError(409, 'Vérification déjà en cours ou validée.');
        }
        selfies.save(req.auth.userId, req.body);
        res.status(201).json({ profile: database.submitSelfie(req.auth.userId) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post('/api/profile/boost', requireAuth, requireVerified, (req, res, next) => {
    try {
      res.json({ profile: database.boostProfile(req.auth.userId) });
    } catch (error) {
      if (error.nextBoostAt) {
        res.status(429).json({ error: 'Boost déjà utilisé récemment.', nextBoostAt: error.nextBoostAt });
        return;
      }
      next(error);
    }
  });

  app.get('/api/discovery', requireAuth, requireVerified, (req, res) => {
    res.json({
      profiles: database.listDiscoveryProfiles(req.auth.userId, {
        activeMode: req.query.mode ?? 'all',
        query: req.query.query ?? '',
        city: req.query.city ?? '',
        ageMin: req.query.ageMin,
        ageMax: req.query.ageMax,
        detail: req.query.detail ?? '',
        tonight: req.query.tonight,
        minScore: req.query.minScore,
        maxKm: req.query.maxKm,
      }),
    });
  });

  app.post('/api/interactions/like', requireAuth, requireVerified, (req, res, next) => {
    try {
      if (!req.body.profileId) {
        throw createHttpError(400, 'profileId est requis.');
      }

      const result = database.likeProfile(req.auth.userId, req.body.profileId, {
        note: req.body.note,
        superLike: req.body.superLike === true,
      });
      if (result.limited) {
        throw createHttpError(429, 'Limite de Super likes atteinte aujourd’hui. Passez Premium pour en avoir plus.');
      }

      res.json(result);
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

  const community = (handler) => (req, res, next) => {
    try {
      handler(req, res);
    } catch (error) {
      next(error.status ? createHttpError(error.status, error.message) : error);
    }
  };

  app.get('/api/events', requireAuth, requireVerified, community((req, res) => {
    res.json({ events: database.listEvents(req.auth.userId, { city: req.query.city ?? '' }) });
  }));
  app.post('/api/events', requireAuth, requireVerified, community((req, res) => {
    res.status(201).json({ event: database.createEvent(req.auth.userId, req.body) });
  }));
  app.post('/api/events/:eventId/join', requireAuth, requireVerified, community((req, res) => {
    res.json({ event: database.joinEvent(req.auth.userId, req.params.eventId) });
  }));
  app.post('/api/events/:eventId/leave', requireAuth, requireVerified, community((req, res) => {
    if (!database.leaveEvent(req.auth.userId, req.params.eventId)) throw Object.assign(new Error('Sortie introuvable.'), { status: 404 });
    res.status(204).end();
  }));

  app.get('/api/posts', requireAuth, requireVerified, community((req, res) => {
    res.json({ posts: database.listPosts(req.auth.userId) });
  }));
  app.post('/api/posts', requireAuth, requireVerified, community((req, res) => {
    res.status(201).json({ post: database.createPost(req.auth.userId, req.body) });
  }));
  app.delete('/api/posts/:postId', requireAuth, community((req, res) => {
    if (!database.deletePost(req.auth.userId, req.params.postId)) throw Object.assign(new Error('Publication introuvable.'), { status: 404 });
    res.status(204).end();
  }));

  app.post('/api/tonight', requireAuth, requireVerified, community((req, res) => {
    res.json({ profile: database.setTonight(req.auth.userId, req.body.active === true) });
  }));

  app.get('/api/likes/received', requireAuth, requireVerified, community((req, res) => {
    res.json(database.listLikesReceived(req.auth.userId));
  }));

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

  app.post('/api/conversations/:conversationId/read', requireAuth, (req, res, next) => {
    try {
      const conversation = database.markConversationRead(req.auth.userId, req.params.conversationId);
      if (!conversation) {
        throw createHttpError(404, 'Conversation introuvable.');
      }

      res.json({ conversation });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/reports', requireAuth, (req, res, next) => {
    try {
      const reason = `${req.body.reason ?? ''}`;
      const kind = req.body.postId ? 'post' : req.body.eventId ? 'event' : 'profile';
      const ref = req.body.postId ?? req.body.eventId ?? req.body.profileId;
      if (!ref || !REPORT_REASONS.has(reason)) {
        throw createHttpError(400, 'Cible et motif valides requis.');
      }

      const details = `${req.body.details ?? ''}`.trim().slice(0, 1000);
      const reported = kind === 'profile'
        ? database.reportProfile(req.auth.userId, ref, { reason, details })
        : database.reportContent(req.auth.userId, kind, `${ref}`, { reason, details });
      if (!reported) {
        throw createHttpError(404, 'Contenu introuvable.');
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

  app.get('/api/admin/selfies', requireAuth, requireAdmin, (_req, res) => {
    res.json({ selfies: database.listPendingSelfies().map(({ userId, ...selfie }) => selfie) });
  });

  app.get('/api/admin/selfies/:id/image', requireAuth, requireAdmin, (req, res, next) => {
    const userId = database.getSelfieOwnerId(req.params.id);
    const file = userId ? selfies.pathFor(userId) : null;
    if (!file) {
      next(createHttpError(404, 'Selfie introuvable.'));
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(file);
  });

  app.post('/api/admin/selfies/:id/resolve', requireAuth, requireAdmin, (req, res, next) => {
    try {
      const userId = database.resolveSelfie(req.params.id, req.body?.approve === true);
      if (!userId) throw createHttpError(404, 'Selfie introuvable.');
      selfies.remove(userId);
      res.json({ resolved: true });
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
      if (!['dismiss', 'suspend', 'remove'].includes(action) || !database.resolveReportById(req.params.reportId, action)) {
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

      const userIds = database.listAccountUserIds(req.auth.userId);
      database.deleteAccount(req.auth.userId);
      userIds.forEach((userId) => { uploads.removeAllForUser(userId); selfies.remove(userId); });
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

  const SITE_BRANDS = {
    amical: { name: 'Lifys Amis', path: '/Amical', theme: '#2f9e8f' },
    amoureux: { name: 'Lifys Love', path: '/Amoureux', theme: '#d6336c' },
    'sans-lendemain': { name: 'Lifys Éphémère', path: '/Sans-lendemain', theme: '#e8590c' },
    mariage: { name: 'Lifys Mariage', path: '/Mariage', theme: '#b8860b' },
    professionnel: { name: 'Lifys Pro', path: '/Professionnel', theme: '#1c7ed6' },
  };
  const HOST_SITES = { amis: 'amical', love: 'amoureux', ephemere: 'sans-lendemain', mariage: 'mariage', pro: 'professionnel' };

  app.get('/manifest.webmanifest', (req, res, next) => {
    const parts = String(req.hostname || '').toLowerCase().split('.');
    const site = config.siteOnly || (parts.length >= 3 ? HOST_SITES[parts[0]] : null);
    const brand = SITE_BRANDS[site];
    if (!brand) return next();
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(config.staticDir, 'manifest.webmanifest'), 'utf8'));
    } catch {
      return next();
    }
    res.type('application/manifest+json').json({
      ...manifest,
      name: brand.name,
      short_name: brand.name.replace('Lifys ', ''),
      theme_color: brand.theme,
      start_url: config.siteOnly || parts.length >= 3 ? '/' : brand.path,
      shortcuts: [],
    });
  });

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${config.appUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    const paths = ['/', ...Object.values(SITE_BRANDS).map((brand) => brand.path), '/cgu', '/confidentialite'];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${config.appUrl}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
  });

  if (fs.existsSync(config.staticDir)) {
    app.use(express.static(config.staticDir));
    app.get(/^(?!\/(api|uploads)\/).*/, (req, res) => {
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


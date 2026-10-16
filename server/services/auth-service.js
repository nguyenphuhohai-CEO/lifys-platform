import crypto from 'node:crypto';

import {
  comparePassword,
  createToken,
  hashPassword,
  normalizeEmail,
  validateEmail,
  validatePassword,
} from '../auth.js';
import { sanitizeProfileInput } from '../db.js';
import { createHttpError } from '../http.js';

function createOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashOpaqueToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function addDuration({ days = 0, hours = 0, minutes = 0 }) {
  return new Date(Date.now() + (((days * 24 + hours) * 60 + minutes) * 60 * 1000)).toISOString();
}

function shouldExposePreview(config) {
  return config.emailDeliveryMode === 'preview';
}

export function createAuthService({ database, config, emailService, logger }) {
  async function buildSessionUser(userId) {
    const [profile, user] = await Promise.all([
      database.getProfileByUserId(userId),
      database.getUserById(userId),
    ]);
    if (!profile) {
      throw createHttpError(401, 'Session introuvable.', 'SESSION_NOT_FOUND');
    }

    return {
      email: profile.email,
      emailVerified: Boolean(profile.emailVerifiedAt),
      role: user?.role ?? 'member',
      profile,
    };
  }

  function issueAccessToken(userId, email, role) {
    return createToken({ userId, email, role }, config);
  }

  async function issueRefreshSession(userId) {
    const refreshToken = createOpaqueToken();
    await database.createRefreshToken(
      userId,
      hashOpaqueToken(refreshToken),
      addDuration({ days: config.refreshTokenTtlDays }),
    );
    return refreshToken;
  }

  async function issueEmailVerificationToken(userId) {
    const token = createOpaqueToken();
    await database.createEmailVerificationToken(
      userId,
      hashOpaqueToken(token),
      addDuration({ hours: config.emailVerificationTokenTtlHours }),
    );
    return token;
  }

  async function issuePasswordResetToken(userId) {
    const token = createOpaqueToken();
    await database.createPasswordResetToken(
      userId,
      hashOpaqueToken(token),
      addDuration({ minutes: config.passwordResetTokenTtlMinutes }),
    );
    return token;
  }

  async function buildSessionResult(userId, refreshToken, extras = {}) {
    const user = await buildSessionUser(userId);
    return {
      token: issueAccessToken(user.profile.userId, user.email, user.role),
      refreshToken,
      user,
      ...extras,
    };
  }

  return {
    async register({ email, password, name, mode }) {
      const normalizedEmail = normalizeEmail(email);
      const initialProfile = sanitizeProfileInput({ name, mode });
      if (!validateEmail(normalizedEmail)) {
        throw createHttpError(400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');
      }

      if (!validatePassword(password)) {
        throw createHttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.', 'INVALID_PASSWORD');
      }

      if (await database.getUserByEmail(normalizedEmail)) {
        throw createHttpError(409, 'Un compte existe déjà avec cet e-mail.', 'EMAIL_ALREADY_EXISTS');
      }

      const created = await database.createUser({
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        name: initialProfile.name || normalizedEmail.split('@')[0] || 'Profil Lifys',
        mode: initialProfile.mode,
      });
      const refreshToken = await issueRefreshSession(created.userId);
      const emailVerificationToken = await issueEmailVerificationToken(created.userId);
      await emailService.sendVerificationEmail({ to: normalizedEmail, token: emailVerificationToken });
      logger.info('Verification email workflow prepared', {
        userId: created.userId,
        mode: emailService.mode,
      });

      return buildSessionResult(created.userId, refreshToken, shouldExposePreview(config)
        ? { previewEmailVerificationToken: emailVerificationToken }
        : {});
    },

    async login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = await database.getUserByEmail(normalizedEmail);
      if (!password || !user || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Identifiants invalides.', 'INVALID_CREDENTIALS');
      }

      const refreshToken = await issueRefreshSession(user.id);
      return buildSessionResult(user.id, refreshToken);
    },

    async refresh(refreshToken) {
      if (!refreshToken) {
        throw createHttpError(401, 'Refresh token manquant.', 'REFRESH_TOKEN_MISSING');
      }

      const nextRefreshToken = createOpaqueToken();
      const userId = await database.rotateRefreshToken(
        hashOpaqueToken(refreshToken),
        hashOpaqueToken(nextRefreshToken),
        addDuration({ days: config.refreshTokenTtlDays }),
      );
      if (!userId) {
        throw createHttpError(401, 'Refresh token expiré ou invalide.', 'REFRESH_TOKEN_INVALID');
      }

      return buildSessionResult(userId, nextRefreshToken);
    },

    async logout(refreshToken) {
      if (refreshToken) {
        await database.revokeRefreshToken(hashOpaqueToken(refreshToken));
      }
    },

    async getSession(userId, accessToken) {
      const user = await buildSessionUser(userId);
      return {
        token: accessToken,
        refreshToken: null,
        user,
      };
    },

    async requestEmailVerification(userId) {
      const user = buildSessionUser(userId);
      if (user.emailVerified) {
        return { alreadyVerified: true };
      }

      const previewToken = await issueEmailVerificationToken(userId);
      await emailService.sendVerificationEmail({ to: user.email, token: previewToken });
      logger.info('Verification email requested', { userId, mode: emailService.mode });
      return shouldExposePreview(config) ? { previewToken } : {};
    },

    async verifyEmail(token) {
      if (!token) {
        throw createHttpError(400, 'token est requis.', 'VALIDATION_ERROR');
      }

      const user = await database.verifyEmailToken(hashOpaqueToken(token));
      if (!user) {
        throw createHttpError(400, 'Lien de vérification invalide ou expiré.', 'EMAIL_VERIFICATION_INVALID');
      }

      return {
        emailVerified: true,
        user: await buildSessionUser(user.id),
      };
    },

    async requestPasswordReset(email) {
      const normalizedEmail = normalizeEmail(email);
      const user = await database.getUserByEmail(normalizedEmail);
      if (!user) {
        logger.warn('Password reset requested for missing account', {
          emailHash: crypto.createHash('sha256').update(normalizedEmail).digest('hex'),
        });
        return {};
      }

      const previewToken = await issuePasswordResetToken(user.id);
      await emailService.sendPasswordResetEmail({ to: normalizedEmail, token: previewToken });
      logger.info('Password reset email requested', { userId: user.id, mode: emailService.mode });
      return shouldExposePreview(config) ? { previewToken } : {};
    },

    async resetPassword({ token, password }) {
      if (!validatePassword(password)) {
        throw createHttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.', 'INVALID_PASSWORD');
      }

      const user = await database.resetPasswordWithToken(hashOpaqueToken(token), hashPassword(password));
      if (!user) {
        throw createHttpError(400, 'Lien de réinitialisation invalide ou expiré.', 'PASSWORD_RESET_INVALID');
      }

      const refreshToken = await issueRefreshSession(user.id);
      return buildSessionResult(user.id, refreshToken);
    },

    async deleteAccount(userId, password) {
      const user = await database.getUserById(userId);
      if (!user || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Mot de passe invalide.', 'INVALID_CREDENTIALS');
      }

      await database.deleteUserAccount(userId);
    },
  };
}

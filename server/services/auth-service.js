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
  return config.nodeEnv !== 'production';
}

export function createAuthService({ database, config }) {
  function buildSessionUser(userId) {
    const profile = database.getProfileByUserId(userId);
    if (!profile) {
      throw createHttpError(401, 'Session introuvable.', 'SESSION_NOT_FOUND');
    }

    return {
      email: profile.email,
      emailVerified: Boolean(profile.emailVerifiedAt),
      profile,
    };
  }

  function issueAccessToken(userId, email) {
    return createToken({ userId, email }, config);
  }

  function issueRefreshSession(userId) {
    const refreshToken = createOpaqueToken();
    database.createRefreshToken(
      userId,
      hashOpaqueToken(refreshToken),
      addDuration({ days: config.refreshTokenTtlDays }),
    );
    return refreshToken;
  }

  function issueEmailVerificationToken(userId) {
    const token = createOpaqueToken();
    database.createEmailVerificationToken(
      userId,
      hashOpaqueToken(token),
      addDuration({ hours: config.emailVerificationTokenTtlHours }),
    );
    return token;
  }

  function issuePasswordResetToken(userId) {
    const token = createOpaqueToken();
    database.createPasswordResetToken(
      userId,
      hashOpaqueToken(token),
      addDuration({ minutes: config.passwordResetTokenTtlMinutes }),
    );
    return token;
  }

  function buildSessionResult(userId, refreshToken, extras = {}) {
    const user = buildSessionUser(userId);
    return {
      token: issueAccessToken(user.profile.userId, user.email),
      refreshToken,
      user,
      ...extras,
    };
  }

  return {
    register({ email, password, name, mode }) {
      const normalizedEmail = normalizeEmail(email);
      const initialProfile = sanitizeProfileInput({ name, mode });
      if (!validateEmail(normalizedEmail)) {
        throw createHttpError(400, 'Adresse e-mail invalide.', 'INVALID_EMAIL');
      }

      if (!validatePassword(password)) {
        throw createHttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.', 'INVALID_PASSWORD');
      }

      if (database.getUserByEmail(normalizedEmail)) {
        throw createHttpError(409, 'Un compte existe déjà avec cet e-mail.', 'EMAIL_ALREADY_EXISTS');
      }

      const created = database.createUser({
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        name: initialProfile.name || normalizedEmail.split('@')[0] || 'Profil Lifys',
        mode: initialProfile.mode,
      });
      const refreshToken = issueRefreshSession(created.userId);
      const emailVerificationToken = issueEmailVerificationToken(created.userId);

      return buildSessionResult(created.userId, refreshToken, shouldExposePreview(config)
        ? { previewEmailVerificationToken: emailVerificationToken }
        : {});
    },

    login({ email, password }) {
      const normalizedEmail = normalizeEmail(email);
      const user = database.getUserByEmail(normalizedEmail);
      if (!password || !user || !comparePassword(password, user.password_hash)) {
        throw createHttpError(401, 'Identifiants invalides.', 'INVALID_CREDENTIALS');
      }

      const refreshToken = issueRefreshSession(user.id);
      return buildSessionResult(user.id, refreshToken);
    },

    refresh(refreshToken) {
      if (!refreshToken) {
        throw createHttpError(401, 'Refresh token manquant.', 'REFRESH_TOKEN_MISSING');
      }

      const nextRefreshToken = createOpaqueToken();
      const userId = database.rotateRefreshToken(
        hashOpaqueToken(refreshToken),
        hashOpaqueToken(nextRefreshToken),
        addDuration({ days: config.refreshTokenTtlDays }),
      );
      if (!userId) {
        throw createHttpError(401, 'Refresh token expiré ou invalide.', 'REFRESH_TOKEN_INVALID');
      }

      return buildSessionResult(userId, nextRefreshToken);
    },

    logout(refreshToken) {
      if (refreshToken) {
        database.revokeRefreshToken(hashOpaqueToken(refreshToken));
      }
    },

    getSession(userId, accessToken) {
      return {
        token: accessToken,
        refreshToken: null,
        user: buildSessionUser(userId),
      };
    },

    requestEmailVerification(userId) {
      const user = buildSessionUser(userId);
      if (user.emailVerified) {
        return { alreadyVerified: true };
      }

      const previewToken = issueEmailVerificationToken(userId);
      return shouldExposePreview(config) ? { previewToken } : {};
    },

    verifyEmail(token) {
      if (!token) {
        throw createHttpError(400, 'token est requis.', 'VALIDATION_ERROR');
      }

      const user = database.verifyEmailToken(hashOpaqueToken(token));
      if (!user) {
        throw createHttpError(400, 'Lien de vérification invalide ou expiré.', 'EMAIL_VERIFICATION_INVALID');
      }

      return {
        emailVerified: true,
        user: buildSessionUser(user.id),
      };
    },

    requestPasswordReset(email) {
      const normalizedEmail = normalizeEmail(email);
      const user = database.getUserByEmail(normalizedEmail);
      if (!user) {
        return {};
      }

      const previewToken = issuePasswordResetToken(user.id);
      return shouldExposePreview(config) ? { previewToken } : {};
    },

    resetPassword({ token, password }) {
      if (!validatePassword(password)) {
        throw createHttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.', 'INVALID_PASSWORD');
      }

      const user = database.resetPasswordWithToken(hashOpaqueToken(token), hashPassword(password));
      if (!user) {
        throw createHttpError(400, 'Lien de réinitialisation invalide ou expiré.', 'PASSWORD_RESET_INVALID');
      }

      const refreshToken = issueRefreshSession(user.id);
      return buildSessionResult(user.id, refreshToken);
    },
  };
}

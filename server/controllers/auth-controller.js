import crypto from 'node:crypto';

import { createHttpError } from '../http.js';
import { normalizeBody, readRequiredString, readOptionalString } from '../validation.js';

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${value}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  parts.push(`Path=${options.path ?? '/'}`);
  parts.push(`SameSite=${options.sameSite ?? 'Lax'}`);
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function parseCookies(headerValue) {
  return `${headerValue ?? ''}`
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return cookies;
      }

      cookies[part.slice(0, separatorIndex)] = decodeURIComponent(part.slice(separatorIndex + 1));
      return cookies;
    }, {});
}

export function createAuthController({ authService, config }) {
  function setRefreshCookie(res, refreshToken) {
    res.append('Set-Cookie', serializeCookie(config.refreshCookieName, encodeURIComponent(refreshToken), {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: config.refreshTokenTtlDays * 24 * 60 * 60,
    }));
  }

  function setCsrfCookie(res, csrfToken) {
    res.append('Set-Cookie', serializeCookie(config.csrfCookieName, encodeURIComponent(csrfToken), {
      httpOnly: false,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: config.refreshTokenTtlDays * 24 * 60 * 60,
    }));
  }

  function clearRefreshCookie(res) {
    res.append('Set-Cookie', serializeCookie(config.refreshCookieName, '', {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }));
    res.append('Set-Cookie', serializeCookie(config.csrfCookieName, '', {
      httpOnly: false,
      secure: config.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 0,
    }));
  }

  function sendSession(res, result, status = 200) {
    if (result.refreshToken) {
      const csrfToken = crypto.randomUUID();
      setRefreshCookie(res, result.refreshToken);
      setCsrfCookie(res, csrfToken);
    }

    res.status(status).json({
      token: result.token,
      user: result.user,
      ...(result.previewEmailVerificationToken ? { previewEmailVerificationToken: result.previewEmailVerificationToken } : {}),
    });
  }

  function getRefreshTokenFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[config.refreshCookieName] ?? '';
  }

  return {
    register(req, res, next) {
      Promise.resolve().then(async () => {
        const body = normalizeBody(req.body);
        const email = readRequiredString(body, 'email', { maxLength: 200 });
        const password = readRequiredString(body, 'password', { maxLength: 200 });
        const name = readOptionalString(body, 'name', { maxLength: 120 }) || email.split('@')[0] || 'Profil Lifys';
        const mode = `${body.mode ?? 'amoureux'}`;
        const result = await authService.register({ email, password, name, mode });
        sendSession(res, result, 201);
      }).catch((error) => {
        next(error);
      });
    },

    login(req, res, next) {
      try {
        const body = normalizeBody(req.body);
        const email = readRequiredString(body, 'email', { maxLength: 200 });
        const password = readOptionalString(body, 'password', { maxLength: 200 });
        const result = authService.login({ email, password });
        sendSession(res, result);
      } catch (error) {
        next(error);
      }
    },

    refresh(req, res, next) {
      try {
        const result = authService.refresh(getRefreshTokenFromRequest(req));
        sendSession(res, result);
      } catch (error) {
        clearRefreshCookie(res);
        next(error);
      }
    },

    logout(req, res, next) {
      try {
        authService.logout(getRefreshTokenFromRequest(req));
        clearRefreshCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },

    session(req, res, next) {
      try {
        res.json(authService.getSession(req.auth.userId, req.auth.token));
      } catch (error) {
        next(error);
      }
    },

    requestEmailVerification(req, res, next) {
      Promise.resolve().then(async () => {
        const result = await authService.requestEmailVerification(req.auth.userId);
        res.json({
          message: result.alreadyVerified
            ? 'Adresse e-mail déjà vérifiée.'
            : config.emailDeliveryMode === 'preview'
              ? 'Un e-mail de vérification a été préparé en mode preview.'
              : 'Un e-mail de vérification vient d’être envoyé.',
          ...(result.previewToken ? { previewToken: result.previewToken } : {}),
        });
      }).catch((error) => {
        next(error);
      });
    },

    verifyEmail(req, res, next) {
      try {
        const body = normalizeBody(req.body);
        const token = readRequiredString(body, 'token', { maxLength: 300 });
        const result = authService.verifyEmail(token);
        res.json({
          message: 'Adresse e-mail vérifiée.',
          user: result.user,
          emailVerified: true,
        });
      } catch (error) {
        next(error);
      }
    },

    requestPasswordReset(req, res, next) {
      Promise.resolve().then(async () => {
        const body = normalizeBody(req.body);
        const email = readRequiredString(body, 'email', { maxLength: 200 });
        const result = await authService.requestPasswordReset(email);
        res.json({
          message: config.emailDeliveryMode === 'preview'
            ? 'Si cet e-mail existe, un lien de réinitialisation a été préparé en mode preview.'
            : 'Si cet e-mail existe, un message de réinitialisation vient d’être envoyé.',
          ...(result.previewToken ? { previewToken: result.previewToken } : {}),
        });
      }).catch((error) => {
        next(error);
      });
    },

    resetPassword(req, res, next) {
      try {
        const body = normalizeBody(req.body);
        const token = readRequiredString(body, 'token', { maxLength: 300 });
        const password = readRequiredString(body, 'password', { maxLength: 200 });
        const result = authService.resetPassword({ token, password });
        sendSession(res, result);
      } catch (error) {
        next(error);
      }
    },

    requireRefreshCookie(req, _res, next) {
      if (!getRefreshTokenFromRequest(req)) {
        next(createHttpError(401, 'Refresh token manquant.', 'REFRESH_TOKEN_MISSING'));
        return;
      }
      next();
    },

    deleteAccount(req, res, next) {
      try {
        const body = normalizeBody(req.body);
        const password = readRequiredString(body, 'password', { maxLength: 200 });
        authService.deleteAccount(req.auth.userId, password);
        clearRefreshCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}

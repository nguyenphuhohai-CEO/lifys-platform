import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter applied to all routes to mitigate brute-force and
 * abuse of authenticated/unauthenticated endpoints alike.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for authentication endpoints (register/login/refresh) to
 * slow down credential stuffing and brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

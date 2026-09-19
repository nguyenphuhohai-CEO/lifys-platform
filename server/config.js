import path from 'node:path';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);

function parsePositiveNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

function parsePortNumber(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('PORT must be zero or a positive integer.');
  }

  return parsed;
}

export function getConfig(overrides = {}) {
  const port = parsePortNumber(overrides.PORT ?? process.env.PORT ?? 3001);
  const databaseFile = overrides.DATABASE_FILE ?? process.env.DATABASE_FILE ?? path.join(rootDir, 'data', 'lifys.sqlite');
  const jwtSecret = overrides.JWT_SECRET ?? process.env.JWT_SECRET ?? 'lifys-dev-secret-change-me';
  const jwtExpiresIn = overrides.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '7d';
  const staticDir = overrides.STATIC_DIR ?? process.env.STATIC_DIR ?? path.join(rootDir, 'dist');
  const nodeEnv = overrides.NODE_ENV ?? process.env.NODE_ENV ?? 'development';
  const corsOrigin = overrides.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '';
  const rateLimitWindowMs = parsePositiveNumber(overrides.RATE_LIMIT_WINDOW_MS ?? process.env.RATE_LIMIT_WINDOW_MS ?? 60000, 'RATE_LIMIT_WINDOW_MS');
  const authRateLimitMax = parsePositiveNumber(overrides.AUTH_RATE_LIMIT_MAX ?? process.env.AUTH_RATE_LIMIT_MAX ?? 10, 'AUTH_RATE_LIMIT_MAX');
  const writeRateLimitMax = parsePositiveNumber(overrides.WRITE_RATE_LIMIT_MAX ?? process.env.WRITE_RATE_LIMIT_MAX ?? 60, 'WRITE_RATE_LIMIT_MAX');

  if (nodeEnv === 'production' && jwtSecret === 'lifys-dev-secret-change-me') {
    throw new Error('JWT_SECRET must be set in production.');
  }

  return {
    port,
    databaseFile,
    jwtSecret,
    jwtExpiresIn,
    staticDir,
    nodeEnv,
    corsOrigin,
    rateLimitWindowMs,
    authRateLimitMax,
    writeRateLimitMax,
  };
}

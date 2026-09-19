import path from 'node:path';

const rootDir = path.resolve(new URL('..', import.meta.url).pathname);

export function getConfig(overrides = {}) {
  const port = Number(overrides.PORT ?? process.env.PORT ?? 3001);
  const databaseFile = overrides.DATABASE_FILE ?? process.env.DATABASE_FILE ?? path.join(rootDir, 'data', 'lifys.sqlite');
  const jwtSecret = overrides.JWT_SECRET ?? process.env.JWT_SECRET ?? 'lifys-dev-secret-change-me';
  const jwtExpiresIn = overrides.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '7d';
  const staticDir = overrides.STATIC_DIR ?? process.env.STATIC_DIR ?? path.join(rootDir, 'dist');
  const nodeEnv = overrides.NODE_ENV ?? process.env.NODE_ENV ?? 'development';
  const corsOrigin = overrides.CORS_ORIGIN ?? process.env.CORS_ORIGIN ?? '';
  const rateLimitWindowMs = Number(overrides.RATE_LIMIT_WINDOW_MS ?? process.env.RATE_LIMIT_WINDOW_MS ?? 60000);
  const authRateLimitMax = Number(overrides.AUTH_RATE_LIMIT_MAX ?? process.env.AUTH_RATE_LIMIT_MAX ?? 10);
  const writeRateLimitMax = Number(overrides.WRITE_RATE_LIMIT_MAX ?? process.env.WRITE_RATE_LIMIT_MAX ?? 60);

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

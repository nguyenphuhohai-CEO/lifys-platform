import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export function getConfig(overrides = {}) {
  const port = Number(overrides.PORT ?? process.env.PORT ?? 3001);
  const databaseFile = overrides.DATABASE_FILE ?? process.env.DATABASE_FILE ?? path.join(rootDir, 'data', 'lifys.sqlite');
  const jwtSecret = overrides.JWT_SECRET ?? process.env.JWT_SECRET ?? 'lifys-dev-secret-change-me';
  const jwtExpiresIn = overrides.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '7d';
  const staticDir = overrides.STATIC_DIR ?? process.env.STATIC_DIR ?? path.join(rootDir, 'dist');
  const nodeEnv = overrides.NODE_ENV ?? process.env.NODE_ENV ?? 'development';

  const trustProxy = overrides.TRUST_PROXY ?? process.env.TRUST_PROXY ?? (nodeEnv === 'production' ? '1' : '0');

  if (nodeEnv === 'production' && jwtSecret === 'lifys-dev-secret-change-me') {
    throw new Error('JWT_SECRET must be set in production.');
  }

  if (nodeEnv === 'production' && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }

  return {
    port,
    databaseFile,
    jwtSecret,
    jwtExpiresIn,
    staticDir,
    nodeEnv,
    trustProxy: Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy),
  };
}

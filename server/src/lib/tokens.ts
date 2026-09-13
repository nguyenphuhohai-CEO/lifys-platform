import jwt from 'jsonwebtoken';

function getRequiredSecret(envName: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', fallback: string) {
  const configuredSecret = process.env[envName];
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV === 'test') {
    return fallback;
  }

  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_INSECURE_DEV_SECRETS === 'true') {
    return fallback;
  }

  throw new Error(`${envName} must be set. For local development only, set ALLOW_INSECURE_DEV_SECRETS=true.`);
}

const ACCESS_TOKEN_SECRET = getRequiredSecret('JWT_ACCESS_SECRET', 'dev-access-secret');
const REFRESH_TOKEN_SECRET = getRequiredSecret('JWT_REFRESH_SECRET', 'dev-refresh-secret');
const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export interface JwtPayload {
  userId: string;
  email: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as JwtPayload;
}

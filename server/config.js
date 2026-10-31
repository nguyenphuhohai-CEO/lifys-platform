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

  const isProduction = nodeEnv === 'production';
  const smtpUrl = overrides.SMTP_URL ?? process.env.SMTP_URL ?? '';
  const flag = (name, fallback) => {
    const raw = overrides[name] ?? process.env[name];
    return raw === undefined || raw === '' ? fallback : `${raw}`.toLowerCase() === 'true';
  };
  const requireEmailVerification = flag('REQUIRE_EMAIL_VERIFICATION', isProduction);
  if (isProduction && requireEmailVerification && !smtpUrl) {
    throw new Error('SMTP_URL is required in production when e-mail verification is enabled.');
  }

  return {
    port,
    databaseFile,
    jwtSecret,
    jwtExpiresIn,
    staticDir,
    nodeEnv,
    trustProxy: Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy),
    appUrl: `${overrides.APP_URL ?? process.env.APP_URL ?? `http://localhost:${port}`}`.replace(/\/+$/, ''),
    smtpUrl,
    mailFrom: overrides.MAIL_FROM ?? process.env.MAIL_FROM ?? 'Lifys <no-reply@lifys.local>',
    billing: {
      secretKey: overrides.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: overrides.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET ?? '',
      premiumPriceId: overrides.STRIPE_PREMIUM_PRICE_ID ?? process.env.STRIPE_PREMIUM_PRICE_ID ?? '',
      premiumPriceCents: Number(overrides.PREMIUM_PRICE_CENTS ?? process.env.PREMIUM_PRICE_CENTS ?? 499),
      automaticTax: ['1', 'true'].includes(``.toLowerCase()),
      currency: `${overrides.PREMIUM_CURRENCY ?? process.env.PREMIUM_CURRENCY ?? 'eur'}`.toLowerCase(),
    },
    siteOnly: ['amical', 'amoureux', 'sans-lendemain', 'mariage', 'professionnel'].includes(`${overrides.SITE_ONLY ?? process.env.SITE_ONLY ?? ''}`.trim()) ? `${overrides.SITE_ONLY ?? process.env.SITE_ONLY}`.trim() : '',
    oauth: {
      google: {
        clientId: `${overrides.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? ''}`.trim(),
        clientSecret: `${overrides.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? ''}`.trim(),
      },
      facebook: {
        clientId: `${overrides.FACEBOOK_APP_ID ?? process.env.FACEBOOK_APP_ID ?? ''}`.trim(),
        clientSecret: `${overrides.FACEBOOK_APP_SECRET ?? process.env.FACEBOOK_APP_SECRET ?? ''}`.trim(),
      },
    },
    uploadDir: overrides.UPLOAD_DIR ?? process.env.UPLOAD_DIR ?? path.join(path.dirname(databaseFile), 'uploads'),
    backup: {
      dir: overrides.BACKUP_DIR ?? process.env.BACKUP_DIR ?? path.join(path.dirname(databaseFile), 'backups'),
      intervalHours: Number(overrides.BACKUP_INTERVAL_HOURS ?? process.env.BACKUP_INTERVAL_HOURS ?? (isProduction ? 24 : 0)) || 0,
      keep: Math.max(1, Number(overrides.BACKUP_KEEP ?? process.env.BACKUP_KEEP ?? 14) || 14),
    },
    analyticsId: (/^G-[A-Z0-9]{4,20}$/.test(`${overrides.GA_MEASUREMENT_ID ?? process.env.GA_MEASUREMENT_ID ?? ''}`.trim()) ? `${overrides.GA_MEASUREMENT_ID ?? process.env.GA_MEASUREMENT_ID}`.trim() : ''),
    ads: {
      client: `${overrides.ADSENSE_CLIENT_ID ?? process.env.ADSENSE_CLIENT_ID ?? ''}`.trim(),
      slot: `${overrides.ADSENSE_SLOT_ID ?? process.env.ADSENSE_SLOT_ID ?? ''}`.trim(),
    },
    seedDemoData: flag('SEED_DEMO_DATA', !isProduction),
    requireEmailVerification,
    adminEmails: `${overrides.ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? ''}`
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  };
}

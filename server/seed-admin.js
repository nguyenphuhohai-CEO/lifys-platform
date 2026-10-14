import './load-env.js';
import { hashPassword, normalizeEmail, validateEmail, validatePassword } from './auth.js';
import { getConfig } from './config.js';
import { createDatabase } from './db.js';

const config = getConfig();
const email = normalizeEmail(process.env.ADMIN_EMAIL ?? '');
const password = `${process.env.ADMIN_PASSWORD ?? ''}`;
const name = `${process.env.ADMIN_NAME ?? 'Lifys Admin'}`.trim() || 'Lifys Admin';
const role = `${process.env.ADMIN_ROLE ?? 'admin'}`.trim().toLowerCase();

if (!['admin', 'moderator'].includes(role)) {
  throw new Error('ADMIN_ROLE must be admin or moderator.');
}

if (!validateEmail(email)) {
  throw new Error('ADMIN_EMAIL must be a valid email address.');
}

if (!validatePassword(password)) {
  throw new Error('ADMIN_PASSWORD must contain at least 8 characters.');
}

const database = await createDatabase(config);

try {
  const existing = await database.getUserByEmail(email);
  let userId = existing?.id ?? null;

  if (!existing) {
    const created = await database.createUser({
      email,
      passwordHash: hashPassword(password),
      name,
      mode: 'professionnel',
      role,
    });
    userId = created.userId;
  }

  if (!userId) {
    throw new Error('Unable to create or retrieve the admin account.');
  }

  await database.updateUserRole(userId, role);
  console.log(JSON.stringify({
    ok: true,
    email,
    role,
    userId,
  }, null, 2));
} finally {
  await database.close?.();
}

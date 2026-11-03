// Vérifie la configuration de production avant mise en ligne : npm run check:prod
import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const results = [];
const check = (level, label, ok, hint) => results.push({ level, label, ok: Boolean(ok), hint });

check('error', 'NODE_ENV=production', env.NODE_ENV === 'production', 'Définissez NODE_ENV=production.');
check('error', 'JWT_SECRET d’au moins 32 caractères', (env.JWT_SECRET ?? '').length >= 32 && env.JWT_SECRET !== 'lifys-dev-secret-change-me', 'Générez-en un : node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
check('error', 'APP_URL en https', /^https:\/\//.test(env.APP_URL ?? ''), 'APP_URL doit être l’adresse publique en https.');
check('error', 'SMTP_URL configuré (vérification e-mail)', env.SMTP_URL, 'Sans SMTP, aucun e-mail de confirmation ne part.');
check('warn', 'MAIL_FROM personnalisé', env.MAIL_FROM && !/lifys\.local/.test(env.MAIL_FROM), 'Utilisez une adresse de votre domaine.');
check('warn', 'Stripe configuré', env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PREMIUM_PRICE_ID, 'Sans Stripe, Premium n’est pas vendable.');
check('warn', 'ADMIN_EMAILS défini', env.ADMIN_EMAILS, 'Nécessaire pour la modération et les statistiques.');
check('warn', 'Comptes de test locaux désactivés', env.LOCAL_TEST_ACCOUNT_ENABLED !== 'true' && env.LOCAL_ADMIN_ACCOUNT_ENABLED !== 'true', 'Désactivez les comptes locaux en production.');
check('warn', 'Clés VAPID (notifications push)', env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY, 'npx web-push generate-vapid-keys');
check('warn', 'OAuth Google ou Facebook', (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) || (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET), 'Optionnel : connexion sociale.');

const placeholders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.js$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('[À COMPLÉTER')) placeholders.push(path.relative(process.cwd(), full));
  }
};
walk('src');
walk('server');
check('error', 'Mentions légales : aucun « [À COMPLÉTER] » restant', placeholders.length === 0, `À remplir dans : ${placeholders.join(', ')}`);

let failed = 0;
for (const { level, label, ok, hint } of results) {
  const icon = ok ? 'OK  ' : level === 'error' ? 'FAIL' : 'WARN';
  if (!ok && level === 'error') failed += 1;
  console.log(`${icon} ${label}${ok ? '' : `\n     → ${hint}`}`);
}
console.log(failed ? `\n${failed} point(s) bloquant(s).` : '\nAucun point bloquant.');
process.exit(failed ? 1 : 0);

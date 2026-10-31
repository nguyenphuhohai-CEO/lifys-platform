import crypto from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;

export function unsubscribeToken(config, userId) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`unsub:${userId}`).digest('hex').slice(0, 32);
}

export function isValidUnsubscribeToken(config, userId, token) {
  const expected = Buffer.from(unsubscribeToken(config, userId));
  const given = Buffer.from(`${token ?? ''}`);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function buildReminderEmail({ unread, expiring }, link, unsubscribeLink) {
  const parts = [];
  const partsEn = [];
  if (unread) {
    parts.push(`${unread} message(s) non lu(s)`);
    partsEn.push(`${unread} unread message(s)`);
  }
  if (expiring) {
    parts.push(`${expiring} match(s) qui expire(nt) dans moins de 12 h`);
    partsEn.push(`${expiring} match(es) expiring within 12 hours`);
  }
  return {
    subject: 'Lifys · on vous attend / someone is waiting for you',
    text: `Bonjour,\n\nVous avez : ${parts.join(' et ')}.\nRépondez maintenant : ${link}\n\n---\n\nHello,\n\nYou have: ${partsEn.join(' and ')}.\nReply now: ${link}\n\nSe désinscrire / Unsubscribe : ${unsubscribeLink}`,
  };
}

export async function runReminders({ db, mailer, config, now = new Date() }) {
  const nowIso = now.toISOString();
  const soonIso = new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const dueBefore = new Date(now.getTime() - DAY_MS).toISOString();

  const users = db.prepare(`
    SELECT id, email FROM users
    WHERE is_demo = 0 AND reminders_off = 0 AND status = 'active' AND email_verified_at IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at < ?)
  `).all(dueBefore);

  const unreadStmt = db.prepare(`
    SELECT COUNT(*) AS n FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN matches mt ON mt.id = c.match_id
    WHERE (mt.user_one_id = @u OR mt.user_two_id = @u) AND m.sender_user_id != @u AND m.read_at IS NULL
      AND (mt.expires_at IS NULL OR mt.expires_at > @now)
  `);
  const expiringStmt = db.prepare(`
    SELECT COUNT(*) AS n FROM matches
    WHERE (user_one_id = @u OR user_two_id = @u) AND expires_at IS NOT NULL AND expires_at > @now AND expires_at <= @soon
  `);
  const mark = db.prepare('UPDATE users SET last_reminder_at = ? WHERE email = (SELECT email FROM users WHERE id = ?)');

  const seen = new Set();
  let sent = 0;
  for (const user of users) {
    if (seen.has(user.email)) continue;
    seen.add(user.email);
    const unread = unreadStmt.get({ u: user.id, now: nowIso }).n;
    const expiring = expiringStmt.get({ u: user.id, now: nowIso, soon: soonIso }).n;
    if (!unread && !expiring) continue;
    const unsubscribeLink = `${config.appUrl}/api/reminders/unsubscribe?u=${user.id}&t=${unsubscribeToken(config, user.id)}`;
    try {
      await mailer.send({ to: user.email, ...buildReminderEmail({ unread, expiring }, config.appUrl, unsubscribeLink) });
      mark.run(nowIso, user.id);
      sent += 1;
    } catch (error) {
      console.error('Rappel non envoyé :', error.message);
    }
  }
  return sent;
}

export function startReminderSchedule(deps, intervalHours) {
  if (!intervalHours) return { stop() {} };
  const timer = setInterval(() => runReminders(deps).catch((error) => console.error('Rappels :', error.message)), intervalHours * 60 * 60 * 1000);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

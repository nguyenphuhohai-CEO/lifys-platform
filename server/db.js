import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import Database from 'better-sqlite3';

import { DEMO_PROFILES, MODES } from '../src/data/demoData.js';
import { computeCompatibility, sanitizeDetails } from '../src/data/siteFields.js';
import { distanceKm } from '../src/data/cities.js';
import { normalizeEmail } from './auth.js';

const TONIGHT_DURATION_MS = 12 * 60 * 60 * 1000;
const SUPER_LIKES_PER_DAY = { free: 1, premium: 5 };

const MODE_IDS = new Set(MODES.map((mode) => mode.id));

function now() {
  return new Date().toISOString();
}

function createPublicId(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

function pairKey(userIdA, userIdB) {
  return [userIdA, userIdB].sort((a, b) => a - b).join(':');
}

export function normalizeInterests(value) {
  const items = Array.isArray(value) ? value : `${value ?? ''}`.split(',');

  return [...new Set(
    items
      .map((item) => `${item ?? ''}`.trim().toLowerCase())
      .filter(Boolean),
  )];
}

const MAX_PHOTOS = 4;
const OWN_UPLOAD = /^\/uploads\/\d+-[a-f0-9]{32}\.(jpg|png|webp)$/;
const CONTENT_HIDE_THRESHOLD = 3;

export function sanitizeProfileInput(value = {}) {
  const age = Number(value.age);
  const avatar = `${value.avatar ?? ''}`.trim();

  const mode = MODE_IDS.has(value.mode) ? value.mode : 'amoureux';

  return {
    details: sanitizeDetails(mode, value.details),
    name: `${value.name ?? ''}`.trim(),
    age: Number.isFinite(age) && age >= 18 && age <= 80 ? age : null,
    city: `${value.city ?? ''}`.trim(),
    bio: `${value.bio ?? ''}`.trim(),
    interests: normalizeInterests(value.interests),
    mode: MODE_IDS.has(value.mode) ? value.mode : 'amoureux',
    avatar: avatar && (/^https?:\/\//i.test(avatar) || /^\/uploads\/\d+-[a-f0-9]{32}\.(jpg|png|webp)$/.test(avatar)) ? avatar : '',
  };
}

function parseInterests(rawValue) {
  try {
    return normalizeInterests(JSON.parse(rawValue ?? '[]'));
  } catch {
    return [];
  }
}

function parseDetails(rawValue) {
  try {
    const parsed = JSON.parse(rawValue ?? '{}');
    const { tonightUntil, ...details } = parsed && typeof parsed === 'object' ? parsed : {};
    if (tonightUntil && new Date(tonightUntil).getTime() > Date.now()) {
      details.tonight = true;
    }
    return details;
  } catch {
    return {};
  }
}

function parsePhotos(rawValue) {
  try {
    const parsed = JSON.parse(rawValue ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((url) => typeof url === 'string').slice(0, MAX_PHOTOS) : [];
  } catch {
    return [];
  }
}

function parseTonightUntil(rawValue) {
  try {
    const { tonightUntil } = JSON.parse(rawValue ?? '{}');
    return tonightUntil && new Date(tonightUntil).getTime() > Date.now() ? tonightUntil : null;
  } catch {
    return null;
  }
}

function isVerifiedProfile(row) {
  return Boolean(row.email_verified_at) && /^\/uploads\//.test(row.avatar ?? '');
}

function isPremium(row) {
  return row.plan === 'premium' && (!row.plan_until || new Date(row.plan_until).getTime() > Date.now());
}

const BOOST_DURATION_MS = 30 * 60 * 1000;
const BOOST_COOLDOWN_FREE_MS = 7 * 24 * 60 * 60 * 1000;
const BOOST_COOLDOWN_PREMIUM_MS = 24 * 60 * 60 * 1000;

function isBoosted(row) {
  return Boolean(row.boost_until) && new Date(row.boost_until).getTime() > Date.now();
}

function serializeProfile(row) {
  return {
    id: row.public_id,
    userId: row.user_id,
    userPublicId: row.user_public_id,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    plan: isPremium(row) ? 'premium' : 'free',
    selfieStatus: row.selfie_status ?? 'none',
    boostUntil: isBoosted(row) ? row.boost_until : null,
    nextBoostAt: row.last_boost_at ? new Date(new Date(row.last_boost_at).getTime() + (isPremium(row) ? BOOST_COOLDOWN_PREMIUM_MS : BOOST_COOLDOWN_FREE_MS)).toISOString() : null,
    name: row.name,
    age: row.age,
    city: row.city,
    bio: row.bio,
    interests: parseInterests(row.interests),
    details: parseDetails(row.details),
    tonightUntil: parseTonightUntil(row.details),
    photos: parsePhotos(row.photos),
    verified: isVerifiedProfile(row),
    selfieVerified: row.selfie_status === 'approved',
    boosted: isBoosted(row),
    mode: row.mode,
    avatar: row.avatar,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializePublicProfile(row) {
  return {
    id: row.public_id,
    name: row.name,
    age: row.age,
    city: row.city,
    bio: row.bio,
    interests: parseInterests(row.interests),
    details: parseDetails(row.details),
    photos: parsePhotos(row.photos),
    verified: isVerifiedProfile(row),
    selfieVerified: row.selfie_status === 'approved',
    boosted: isBoosted(row),
    mode: row.mode,
    avatar: row.avatar,
    isDemo: Boolean(row.is_demo),
  };
}

// Sur ces sites, un match disparaît si personne n'écrit dans les 24 h.
const EXPIRING_SITES = new Set(['amoureux', 'sans-lendemain', 'amical']);
const MATCH_TTL_MS = 24 * 60 * 60 * 1000;

function isExpired(expiresAt) {
  return Boolean(expiresAt) && expiresAt <= new Date().toISOString();
}

function serializeMatch(row) {
  return {
    expiresAt: row.expires_at ?? null,
    id: row.match_public_id,
    profileId: row.profile_public_id,
    name: row.name,
    city: row.city,
    mode: row.mode,
    avatar: row.avatar,
    reason: row.reason,
    matchedAt: row.created_at,
  };
}

function buildMatchReason(currentProfile, targetProfile, hasReciprocalLike) {
  if (hasReciprocalLike) {
    return 'Like mutuel confirmé sur Lifys.';
  }

  if (currentProfile.mode === targetProfile.mode) {
    return `Même intention : ${currentProfile.mode}.`;
  }

  if (currentProfile.city && currentProfile.city.toLowerCase() === targetProfile.city.toLowerCase()) {
    return `Même ville : ${targetProfile.city}.`;
  }

  const sharedInterest = targetProfile.interests.find((interest) => currentProfile.interests.includes(interest));
  if (sharedInterest) {
    return `Centre d’intérêt partagé : ${sharedInterest}.`;
  }

  return 'Affinité démonstrative validée par le moteur de matching.';
}

export function createDatabase(databaseFile, options = {}) {
  const { seedDemoData: shouldSeedDemoData = true, requireEmailVerification = false } = options;
  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  const db = new Database(databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      site TEXT NOT NULL DEFAULT 'amoureux',
      UNIQUE(email, site)
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      public_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      age INTEGER,
      city TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      interests TEXT NOT NULL DEFAULT '[]',
      mode TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, target_user_id)
    );

    CREATE TABLE IF NOT EXISTS passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, target_user_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      pair_key TEXT NOT NULL UNIQUE,
      user_one_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_two_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      match_id INTEGER NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      host_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      place TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      starts_at TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 6,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_attendees (
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'post',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, blocked_user_id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT NOT NULL UNIQUE,
      reporter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
  `);

  const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
  for (const [column, definition] of [
    ['email_verified_at', 'TEXT'],
    ['status', "TEXT NOT NULL DEFAULT 'active'"],
    ['terms_accepted_at', 'TEXT'],
    ['terms_version', 'TEXT'],
    ['plan', "TEXT NOT NULL DEFAULT 'free'"],
    ['plan_until', 'TEXT'],
    ['stripe_customer_id', 'TEXT'],
    ['stripe_subscription_id', 'TEXT'],
    ['site', "TEXT NOT NULL DEFAULT 'amoureux'"],
  ]) {
    if (!userColumns.has(column)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
  const profileColumns = new Set(db.prepare('PRAGMA table_info(profiles)').all().map((column) => column.name));
  if (!profileColumns.has('details')) {
    db.exec("ALTER TABLE profiles ADD COLUMN details TEXT NOT NULL DEFAULT '{}'");
  }
  if (!profileColumns.has('photos')) {
    db.exec("ALTER TABLE profiles ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'");
  }
  const matchColumns = new Set(db.prepare('PRAGMA table_info(matches)').all().map((column) => column.name));
  if (!matchColumns.has('expires_at')) {
    db.exec('ALTER TABLE matches ADD COLUMN expires_at TEXT');
  }
  const messageColumns = new Set(db.prepare('PRAGMA table_info(messages)').all().map((column) => column.name));
  if (!messageColumns.has('read_at')) {
    db.exec('ALTER TABLE messages ADD COLUMN read_at TEXT');
    db.exec('UPDATE messages SET read_at = created_at');
  }
  const reportColumns = new Set(db.prepare('PRAGMA table_info(reports)').all().map((column) => column.name));
  for (const [column, definition] of [
    ['content_kind', "TEXT NOT NULL DEFAULT 'profile'"],
    ['content_ref', "TEXT NOT NULL DEFAULT ''"],
    ['content_excerpt', "TEXT NOT NULL DEFAULT ''"],
  ]) {
    if (!reportColumns.has(column)) db.exec(`ALTER TABLE reports ADD COLUMN ${column} ${definition}`);
  }
  const likeColumns = new Set(db.prepare('PRAGMA table_info(likes)').all().map((column) => column.name));
  if (!likeColumns.has('note')) {
    db.exec("ALTER TABLE likes ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  }
  if (!likeColumns.has('super')) {
    db.exec('ALTER TABLE likes ADD COLUMN super INTEGER NOT NULL DEFAULT 0');
  }
  if (!userColumns.has('site')) {
    db.exec('UPDATE users SET site = COALESCE((SELECT mode FROM profiles WHERE profiles.user_id = users.id), \'amoureux\')');
  }

  // Bases créées avant les sites séparés : l'e-mail était unique globalement, il doit l'être par site.
  const hasGlobalEmailUnique = db.prepare('PRAGMA index_list(users)').all().some((index) => {
    if (!index.unique) return false;
    const columns = db.prepare(`PRAGMA index_info(${JSON.stringify(index.name)})`).all();
    return columns.length === 1 && columns[0].name === 'email';
  });
  if (hasGlobalEmailUnique) {
    db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            public_id TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_demo INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            site TEXT NOT NULL DEFAULT 'amoureux',
            email_verified_at TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            terms_accepted_at TEXT,
            terms_version TEXT,
            plan TEXT NOT NULL DEFAULT 'free',
            plan_until TEXT,
            stripe_customer_id TEXT,
            stripe_subscription_id TEXT,
            UNIQUE(email, site)
          );
          INSERT INTO users_new (id, public_id, email, password_hash, is_demo, created_at, site, email_verified_at, status, terms_accepted_at, terms_version, plan, plan_until, stripe_customer_id, stripe_subscription_id)
          SELECT id, public_id, email, password_hash, is_demo, created_at, site, email_verified_at, status, terms_accepted_at, terms_version, plan, plan_until, stripe_customer_id, stripe_subscription_id FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
        `);
        if (db.pragma('foreign_key_check').length) {
          throw new Error('users migration broke foreign keys');
        }
      })();
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
  db.exec('UPDATE users SET email_verified_at = created_at WHERE is_demo = 1 AND email_verified_at IS NULL');
  const lateUserColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((column) => column.name));
  for (const [column, definition] of [['selfie_status', "TEXT NOT NULL DEFAULT 'none'"], ['selfie_file', 'TEXT']]) {
    if (!lateUserColumns.has(column)) db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
  }
  const lateProfileColumns = new Set(db.prepare('PRAGMA table_info(profiles)').all().map((column) => column.name));
  for (const column of ['boost_until', 'last_boost_at']) {
    if (!lateProfileColumns.has(column)) db.exec(`ALTER TABLE profiles ADD COLUMN ${column} TEXT`);
  }

  const statements = {
    insertUser: db.prepare(`
      INSERT INTO users (public_id, email, password_hash, is_demo, created_at, terms_accepted_at, terms_version, email_verified_at, site)
      VALUES (@public_id, @email, @password_hash, @is_demo, @created_at, @terms_accepted_at, @terms_version, @email_verified_at, @site)
    `),
    insertProfile: db.prepare(`
      INSERT INTO profiles (user_id, public_id, name, age, city, bio, interests, mode, avatar, created_at, updated_at)
      VALUES (@user_id, @public_id, @name, @age, @city, @bio, @interests, @mode, @avatar, @created_at, @updated_at)
    `),
    findUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ? AND site = ?`),
    findUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
    findProfileByUserId: db.prepare(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.is_demo, users.email_verified_at, users.status, users.plan, users.plan_until, users.selfie_status
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.user_id = ?
    `),
    findProfileByPublicId: db.prepare(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.is_demo, users.email_verified_at, users.status, users.plan, users.plan_until, users.selfie_status
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.public_id = ?
    `),
    listProfilesExcludingUser: db.prepare(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.is_demo, users.email_verified_at, users.status, users.plan, users.plan_until, users.selfie_status
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.user_id != @user_id
        AND users.status = 'active'
        AND (users.is_demo = 1 OR users.email_verified_at IS NOT NULL OR @include_unverified = 1)
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocks.user_id = @user_id AND blocks.blocked_user_id = users.id)
             OR (blocks.user_id = users.id AND blocks.blocked_user_id = @user_id)
        )
      ORDER BY users.is_demo DESC, profiles.updated_at DESC
    `),
    insertVerification: db.prepare(`INSERT OR REPLACE INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)`),
    deleteVerificationsForUser: db.prepare(`DELETE FROM email_verifications WHERE user_id = ?`),
    findVerification: db.prepare(`SELECT * FROM email_verifications WHERE token_hash = ?`),
    setPlanByCustomer: db.prepare(`UPDATE users SET plan = @plan, plan_until = @plan_until, stripe_subscription_id = COALESCE(@subscription_id, stripe_subscription_id) WHERE stripe_customer_id = @customer_id`),
    setPlanById: db.prepare(`UPDATE users SET plan = @plan, plan_until = @plan_until, stripe_customer_id = COALESCE(@customer_id, stripe_customer_id), stripe_subscription_id = COALESCE(@subscription_id, stripe_subscription_id) WHERE email = (SELECT email FROM users u WHERE u.id = @user_id)`),
    markEmailVerified: db.prepare(`UPDATE users SET email_verified_at = ? WHERE email = (SELECT email FROM users u WHERE u.id = ?) AND email_verified_at IS NULL`),
    insertBlock: db.prepare(`INSERT OR IGNORE INTO blocks (user_id, blocked_user_id, created_at) VALUES (?, ?, ?)`),
    isBlockedPair: db.prepare(`
      SELECT 1 FROM blocks
      WHERE (user_id = @a AND blocked_user_id = @b) OR (user_id = @b AND blocked_user_id = @a)
      LIMIT 1
    `),
    insertReport: db.prepare(`
      INSERT INTO reports (public_id, reporter_user_id, target_user_id, reason, details, created_at, content_kind, content_ref, content_excerpt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    listOpenReports: db.prepare(`
      SELECT reports.public_id, reports.reason, reports.details, reports.created_at,
        reports.content_kind, reports.content_ref, reports.content_excerpt,
        reporter.email AS reporter_email, target.email AS target_email, target.public_id AS target_user_public_id,
        target.status AS target_status, target_profile.name AS target_name
      FROM reports
      JOIN users AS reporter ON reporter.id = reports.reporter_user_id
      JOIN users AS target ON target.id = reports.target_user_id
      JOIN profiles AS target_profile ON target_profile.user_id = target.id
      WHERE reports.status = 'open'
      ORDER BY reports.created_at ASC
    `),
    findReport: db.prepare(`SELECT * FROM reports WHERE public_id = ?`),
    resolveReport: db.prepare(`UPDATE reports SET status = ?, resolved_at = ? WHERE id = ?`),
    resolveReportsForTarget: db.prepare(`UPDATE reports SET status = 'actioned', resolved_at = ? WHERE target_user_id = ? AND status = 'open'`),
    setUserStatus: db.prepare(`UPDATE users SET status = ? WHERE email = (SELECT email FROM users u WHERE u.id = ?)`),
    listAccountUserIds: db.prepare(`SELECT id FROM users WHERE email = (SELECT email FROM users u WHERE u.id = ?)`),
    findAnyUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ? AND is_demo = 0 ORDER BY id LIMIT 1`),
    deleteUser: db.prepare(`DELETE FROM users WHERE email = (SELECT email FROM users u WHERE u.id = ?) AND is_demo = 0`),
    deleteDemoUsers: db.prepare(`DELETE FROM users WHERE is_demo = 1`),
    listLikesGiven: db.prepare(`
      SELECT profiles.public_id AS profile_id, likes.created_at FROM likes
      JOIN profiles ON profiles.user_id = likes.target_user_id WHERE likes.user_id = ?
    `),
    updateProfile: db.prepare(`
      UPDATE profiles
      SET name = @name, age = @age, city = @city, bio = @bio, interests = @interests, mode = @mode, avatar = @avatar, details = @details, updated_at = @updated_at
      WHERE user_id = @user_id
    `),
    setPhotos: db.prepare('UPDATE profiles SET photos = ? WHERE user_id = ?'),
    setDetails: db.prepare('UPDATE profiles SET details = ? WHERE user_id = ?'),
    setProfileDetailsIfEmpty: db.prepare(`UPDATE profiles SET details = ? WHERE public_id = ? AND details = '{}'`),
    upsertLike: db.prepare(`
      INSERT INTO likes (user_id, target_user_id, created_at, note, super) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, target_user_id) DO UPDATE SET note = excluded.note, super = excluded.super
    `),
    getLike: db.prepare(`SELECT note, super FROM likes WHERE user_id = ? AND target_user_id = ?`),
    countSuperLikesSince: db.prepare(`SELECT COUNT(*) AS count FROM likes WHERE user_id = ? AND super = 1 AND created_at >= ?`),
    deletePassForPair: db.prepare(`DELETE FROM passes WHERE user_id = ? AND target_user_id = ?`),
    upsertPass: db.prepare(`INSERT OR IGNORE INTO passes (user_id, target_user_id, created_at) VALUES (?, ?, ?)`),
    hiddenTargetIds: db.prepare(`
      SELECT target_user_id AS id FROM likes WHERE user_id = ?
      UNION
      SELECT target_user_id AS id FROM passes WHERE user_id = ?
    `),
    hasReciprocalLike: db.prepare(`SELECT 1 FROM likes WHERE user_id = ? AND target_user_id = ? LIMIT 1`),
    insertMatch: db.prepare(`
      INSERT OR IGNORE INTO matches (public_id, pair_key, user_one_id, user_two_id, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    findMatchByPairKey: db.prepare(`SELECT * FROM matches WHERE pair_key = ?`),
    insertConversation: db.prepare(`
      INSERT OR IGNORE INTO conversations (public_id, match_id, created_at)
      VALUES (?, ?, ?)
    `),
    findConversationByMatchId: db.prepare(`SELECT * FROM conversations WHERE match_id = ?`),
    insertMessage: db.prepare(`
      INSERT INTO messages (public_id, conversation_id, sender_user_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `),
    listMatchesForUser: db.prepare(`
      SELECT
        matches.public_id AS match_public_id,
        matches.reason,
        matches.created_at,
        matches.expires_at,
        profiles.public_id AS profile_public_id,
        profiles.name,
        profiles.city,
        profiles.mode,
        profiles.avatar
      FROM matches
      JOIN users ON users.id = CASE WHEN matches.user_one_id = @user_id THEN matches.user_two_id ELSE matches.user_one_id END
      JOIN profiles ON profiles.user_id = users.id
      WHERE (matches.user_one_id = @user_id OR matches.user_two_id = @user_id)
        AND users.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocks.user_id = @user_id AND blocks.blocked_user_id = users.id)
             OR (blocks.user_id = users.id AND blocks.blocked_user_id = @user_id)
        )
      ORDER BY matches.created_at DESC
    `),
    listConversationsForUser: db.prepare(`
      SELECT
        conversations.id AS conversation_id,
        conversations.public_id AS conversation_public_id,
        conversations.created_at AS conversation_created_at,
        matches.public_id AS match_public_id,
        matches.expires_at,
        profiles.public_id AS profile_public_id,
        profiles.name,
        profiles.mode,
        profiles.avatar,
        profiles.city
      FROM conversations
      JOIN matches ON matches.id = conversations.match_id
      JOIN users ON users.id = CASE WHEN matches.user_one_id = @user_id THEN matches.user_two_id ELSE matches.user_one_id END
      JOIN profiles ON profiles.user_id = users.id
      WHERE (matches.user_one_id = @user_id OR matches.user_two_id = @user_id)
        AND users.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocks.user_id = @user_id AND blocks.blocked_user_id = users.id)
             OR (blocks.user_id = users.id AND blocks.blocked_user_id = @user_id)
        )
      ORDER BY conversations.created_at DESC
    `),
    listMessagesForConversation: db.prepare(`
      SELECT messages.public_id, messages.content, messages.created_at, messages.sender_user_id, messages.read_at
      FROM messages
      JOIN conversations ON conversations.id = messages.conversation_id
      JOIN matches ON matches.id = conversations.match_id
      WHERE conversations.public_id = @conversation_public_id
        AND (matches.user_one_id = @user_id OR matches.user_two_id = @user_id)
      ORDER BY messages.created_at ASC
    `),
    findConversationContext: db.prepare(`
      SELECT conversations.id, conversations.public_id, matches.user_one_id, matches.user_two_id
      FROM conversations
      JOIN matches ON matches.id = conversations.match_id
      WHERE conversations.public_id = ?
    `),
    deleteMessagesForUser: db.prepare(`
      DELETE FROM messages
      WHERE conversation_id IN (
        SELECT conversations.id
        FROM conversations
        JOIN matches ON matches.id = conversations.match_id
        WHERE matches.user_one_id = ? OR matches.user_two_id = ?
      )
    `),
    deleteConversationsForUser: db.prepare(`
      DELETE FROM conversations
      WHERE match_id IN (
        SELECT id FROM matches WHERE user_one_id = ? OR user_two_id = ?
      )
    `),
    deleteMatchesForUser: db.prepare(`DELETE FROM matches WHERE user_one_id = ? OR user_two_id = ?`),
    deleteLikesForUser: db.prepare(`DELETE FROM likes WHERE user_id = ?`),
    deletePassesForUser: db.prepare(`DELETE FROM passes WHERE user_id = ?`),
    deleteDemoMessagesForUser: db.prepare(`
      DELETE FROM messages
      WHERE conversation_id IN (
        SELECT conversations.id
        FROM conversations
        JOIN matches ON matches.id = conversations.match_id
        JOIN users AS other_user ON other_user.id = CASE
          WHEN matches.user_one_id = @user_id THEN matches.user_two_id
          ELSE matches.user_one_id
        END
        WHERE (matches.user_one_id = @user_id OR matches.user_two_id = @user_id)
          AND other_user.is_demo = 1
      )
    `),
    deleteDemoConversationsForUser: db.prepare(`
      DELETE FROM conversations
      WHERE match_id IN (
        SELECT matches.id
        FROM matches
        JOIN users AS other_user ON other_user.id = CASE
          WHEN matches.user_one_id = @user_id THEN matches.user_two_id
          ELSE matches.user_one_id
        END
        WHERE (matches.user_one_id = @user_id OR matches.user_two_id = @user_id)
          AND other_user.is_demo = 1
      )
    `),
    deleteDemoMatchesForUser: db.prepare(`
      DELETE FROM matches
      WHERE id IN (
        SELECT matches.id
        FROM matches
        JOIN users AS other_user ON other_user.id = CASE
          WHEN matches.user_one_id = @user_id THEN matches.user_two_id
          ELSE matches.user_one_id
        END
        WHERE (matches.user_one_id = @user_id OR matches.user_two_id = @user_id)
          AND other_user.is_demo = 1
      )
    `),
  };

  if (shouldSeedDemoData) {
    seedDemoData(db, statements);
  } else {
    statements.deleteDemoUsers.run();
  }

  function createUser({ email, passwordHash, name, mode = 'amoureux', termsVersion = null }) {
    const createdAt = now();
    const userResult = statements.insertUser.run({
      public_id: createPublicId('user'),
      email: normalizeEmail(email),
      password_hash: passwordHash,
      is_demo: 0,
      created_at: createdAt,
      terms_accepted_at: termsVersion ? createdAt : null,
      terms_version: termsVersion,
      email_verified_at: requireEmailVerification ? null : createdAt,
      site: mode,
    });

    statements.insertProfile.run({
      user_id: userResult.lastInsertRowid,
      public_id: createPublicId('profile'),
      name,
      age: null,
      city: '',
      bio: '',
      interests: '[]',
      mode,
      avatar: '',
      created_at: createdAt,
      updated_at: createdAt,
    });

    return {
      userId: userResult.lastInsertRowid,
      profile: getProfileByUserId(userResult.lastInsertRowid),
    };
  }

  // Un compte = un e-mail et un mot de passe ; chaque site en tient un profil distinct.
  function getAccountByEmail(email) {
    return statements.findAnyUserByEmail.get(normalizeEmail(email));
  }

  function listAccountUserIds(userId) {
    return statements.listAccountUserIds.all(userId).map((row) => row.id);
  }

  function joinSite(account, site, name) {
    const createdAt = now();
    const userResult = statements.insertUser.run({
      public_id: createPublicId('user'),
      email: account.email,
      password_hash: account.password_hash,
      is_demo: 0,
      created_at: createdAt,
      terms_accepted_at: account.terms_accepted_at,
      terms_version: account.terms_version,
      email_verified_at: account.email_verified_at,
      site,
    });
    const userId = userResult.lastInsertRowid;
    db.prepare('UPDATE users SET status = ?, plan = ?, plan_until = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
      .run(account.status, account.plan, account.plan_until, account.stripe_customer_id, account.stripe_subscription_id, userId);

    statements.insertProfile.run({
      user_id: userId,
      public_id: createPublicId('profile'),
      name,
      age: null,
      city: '',
      bio: '',
      interests: '[]',
      mode: site,
      avatar: '',
      created_at: createdAt,
      updated_at: createdAt,
    });

    return statements.findUserById.get(userId);
  }

  function getUserByEmail(email, site = 'amoureux') {
    return statements.findUserByEmail.get(normalizeEmail(email), site);
  }

  function getProfileByUserId(userId) {
    const row = statements.findProfileByUserId.get(userId);
    return row ? serializeProfile(row) : null;
  }

  function getProfileByPublicId(profilePublicId) {
    const row = statements.findProfileByPublicId.get(profilePublicId);
    return row ? serializeProfile(row) : null;
  }

  function updateUserProfile(userId, input) {
    const profile = sanitizeProfileInput(input);
    const { tonight, ...storedDetails } = profile.details;
    if (tonight) {
      storedDetails.tonightUntil = new Date(Date.now() + TONIGHT_DURATION_MS).toISOString();
    }
    statements.updateProfile.run({
      user_id: userId,
      name: profile.name,
      age: profile.age,
      city: profile.city,
      bio: profile.bio,
      interests: JSON.stringify(profile.interests),
      mode: profile.mode,
      avatar: profile.avatar,
      details: JSON.stringify(storedDetails),
      updated_at: now(),
    });
    return getProfileByUserId(userId);
  }

  function listDiscoveryProfiles(userId, filters = {}) {
    const hiddenUserIds = new Set(statements.hiddenTargetIds.all(userId, userId).map((row) => row.id));
    const activeMode = `${filters.activeMode ?? 'all'}`;
    const siteMode = statements.findProfileByUserId.get(userId)?.mode ?? null;
    const query = `${filters.query ?? ''}`.trim().toLowerCase();
    const city = `${filters.city ?? ''}`.trim().toLowerCase();
    const ageMin = Number(filters.ageMin) || 0;
    const ageMax = Number(filters.ageMax) || 0;
    const detail = `${filters.detail ?? ''}`.trim().toLowerCase();
    const minScore = Number(filters.minScore) || 0;
    const maxKm = Number(filters.maxKm) || 0;
    const tonightOnly = filters.tonight === true || filters.tonight === 'true' || filters.tonight === '1';
    const currentProfile = getProfileByUserId(userId);

    return statements.listProfilesExcludingUser.all({ user_id: userId, include_unverified: requireEmailVerification ? 0 : 1 })
      .filter((row) => !hiddenUserIds.has(row.user_id))
      .map(serializePublicProfile)
      .filter((profile) => !siteMode || profile.mode === siteMode)
      .filter((profile) => activeMode === 'all' || profile.mode === activeMode)
      .filter((profile) => !city || profile.city.toLowerCase().includes(city))
      .filter((profile) => !ageMin || (profile.age ?? 0) >= ageMin)
      .filter((profile) => !ageMax || (profile.age ?? 0) <= ageMax)
      .filter((profile) => !tonightOnly || profile.details.tonight)
      .filter((profile) => !detail || Object.values(profile.details).flat().join(' ').toLowerCase().includes(detail))
      .filter((profile) => {
        if (!query) {
          return true;
        }

        return [profile.name, profile.city, profile.bio, ...profile.interests]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .map((profile) => (currentProfile ? { ...profile, compatibility: computeCompatibility(currentProfile, profile) } : profile))
      .map((profile) => ({ ...profile, distanceKm: currentProfile ? distanceKm(currentProfile.city, profile.city) : null }))
      .filter((profile) => !minScore || (profile.compatibility?.score ?? 0) >= minScore)
      .filter((profile) => !maxKm || (profile.distanceKm !== null && profile.distanceKm <= maxKm))
      .sort((left, right) => Number(right.boosted) - Number(left.boosted) || (right.compatibility?.score ?? 0) - (left.compatibility?.score ?? 0));
  }

  function getOrCreateMatch(userId, targetUserId, currentProfile, targetProfile) {
    const key = pairKey(userId, targetUserId);
    const reciprocal = Boolean(statements.hasReciprocalLike.get(targetUserId, userId));
    const reason = buildMatchReason(currentProfile, targetProfile, reciprocal);
    const createdAt = now();

    const inserted = statements.insertMatch.run(
      createPublicId('match'),
      key,
      Math.min(userId, targetUserId),
      Math.max(userId, targetUserId),
      reason,
      createdAt,
    ).changes > 0;

    const matchRow = statements.findMatchByPairKey.get(key);
    if (inserted && EXPIRING_SITES.has(currentProfile.mode)) {
      db.prepare('UPDATE matches SET expires_at = ? WHERE id = ?').run(new Date(Date.now() + MATCH_TTL_MS).toISOString(), matchRow.id);
    }
    statements.insertConversation.run(createPublicId('conversation'), matchRow.id, createdAt);
    const conversationRow = statements.findConversationByMatchId.get(matchRow.id);
    const existingMessages = statements.listMessagesForConversation.all({
      conversation_public_id: conversationRow.public_id,
      user_id: userId,
    });

    if (!existingMessages.length) {
      for (const [senderId, receiverId] of [[userId, targetUserId], [targetUserId, userId]]) {
        const like = statements.getLike.get(senderId, receiverId);
        if (like?.note) {
          statements.insertMessage.run(createPublicId('message'), conversationRow.id, senderId, like.note, createdAt);
        }
      }

      statements.insertMessage.run(
        createPublicId('message'),
        conversationRow.id,
        targetUserId,
        `Bonjour ${currentProfile.name || 'et bienvenue'} ! Ce premier message confirme votre match Lifys.`,
        createdAt,
      );
    }

    return {
      match: listMatchesForUser(userId).find((item) => item.id === matchRow.public_id) ?? null,
      conversationId: conversationRow.public_id,
    };
  }

  function likeProfile(userId, profilePublicId, options = {}) {
    const currentProfile = getProfileByUserId(userId);
    const targetProfile = getProfileByPublicId(profilePublicId);

    if (!currentProfile || !targetProfile || targetProfile.userId === userId || targetProfile.mode !== currentProfile.mode) {
      return { matched: false, match: null, conversationId: null };
    }

    const targetStatus = statements.findUserById.get(targetProfile.userId);
    if (
      targetStatus?.status !== 'active'
      || (requireEmailVerification && !targetStatus.is_demo && !targetStatus.email_verified_at)
      || statements.isBlockedPair.get({ a: userId, b: targetProfile.userId })
    ) {
      return { matched: false, match: null, conversationId: null };
    }

    const note = `${options.note ?? ''}`.trim().slice(0, 280);
    const superLike = Boolean(options.superLike);
    if (superLike) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const used = statements.countSuperLikesSince.get(userId, since).count;
      if (used >= SUPER_LIKES_PER_DAY[currentProfile.plan]) {
        return { matched: false, match: null, conversationId: null, limited: true };
      }
    }

    statements.upsertLike.run(userId, targetProfile.userId, now(), note, superLike ? 1 : 0);
    statements.deletePassForPair.run(userId, targetProfile.userId);

    const reciprocal = Boolean(statements.hasReciprocalLike.get(targetProfile.userId, userId));
    const shouldMatch = reciprocal || targetProfile.isDemo;

    if (!shouldMatch) {
      return { matched: false, match: null, conversationId: null };
    }

    const result = getOrCreateMatch(userId, targetProfile.userId, currentProfile, targetProfile);
    return { matched: true, ...result };
  }

  function passProfile(userId, profilePublicId) {
    const targetProfile = getProfileByPublicId(profilePublicId);
    if (!targetProfile || targetProfile.userId === userId) {
      return false;
    }

    statements.upsertPass.run(userId, targetProfile.userId, now());
    return true;
  }

  function listMatchesForUser(userId) {
    return statements.listMatchesForUser.all({ user_id: userId }).filter((row) => !isExpired(row.expires_at)).map(serializeMatch);
  }

  function listConversationsForUser(userId) {
    return statements.listConversationsForUser.all({ user_id: userId }).filter((row) => !isExpired(row.expires_at)).map((conversation) => ({
      expiresAt: conversation.expires_at ?? null,
      id: conversation.conversation_public_id,
      matchId: conversation.match_public_id,
      profileId: conversation.profile_public_id,
      name: conversation.name,
      mode: conversation.mode,
      avatar: conversation.avatar,
      city: conversation.city,
      messages: statements.listMessagesForConversation.all({
        conversation_public_id: conversation.conversation_public_id,
        user_id: userId,
      }).map((message) => ({
        id: message.public_id,
        sender: message.sender_user_id === userId ? 'me' : 'them',
        text: message.content,
        createdAt: message.created_at,
        readAt: message.read_at,
      })),
    })).map((conversation) => ({
      ...conversation,
      unread: conversation.messages.filter((message) => message.sender === 'them' && !message.readAt).length,
    }));
  }

  function markConversationRead(userId, conversationPublicId) {
    const conversation = statements.findConversationContext.get(conversationPublicId);
    if (!conversation || (conversation.user_one_id !== userId && conversation.user_two_id !== userId)) {
      return null;
    }
    db.prepare('UPDATE messages SET read_at = ? WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL')
      .run(now(), conversation.id, userId);
    return listConversationsForUser(userId).find((item) => item.id === conversationPublicId) ?? null;
  }

  function addMessage(userId, conversationPublicId, text) {
    const conversation = statements.findConversationContext.get(conversationPublicId);
    if (!conversation || (conversation.user_one_id !== userId && conversation.user_two_id !== userId)) {
      return null;
    }

    const otherUserId = conversation.user_one_id === userId ? conversation.user_two_id : conversation.user_one_id;
    if (statements.isBlockedPair.get({ a: userId, b: otherUserId }) || statements.findUserById.get(otherUserId)?.status !== 'active') {
      return null;
    }
    const match = db.prepare('SELECT expires_at FROM matches WHERE id = (SELECT match_id FROM conversations WHERE id = ?)').get(conversation.id);
    if (isExpired(match?.expires_at)) {
      return null;
    }
    statements.insertMessage.run(createPublicId('message'), conversation.id, userId, `${text}`.trim(), now());
    db.prepare('UPDATE matches SET expires_at = NULL WHERE id = (SELECT match_id FROM conversations WHERE id = ?)').run(conversation.id);
    return listConversationsForUser(userId).find((item) => item.id === conversationPublicId) ?? null;
  }

  const resetUserData = db.transaction((userId) => {
    statements.deleteDemoMessagesForUser.run({ user_id: userId });
    statements.deleteDemoConversationsForUser.run({ user_id: userId });
    statements.deleteDemoMatchesForUser.run({ user_id: userId });
    statements.deleteLikesForUser.run(userId);
    statements.deletePassesForUser.run(userId);
    statements.updateProfile.run({
      user_id: userId,
      name: 'Profil Lifys',
      age: null,
      city: '',
      bio: '',
      interests: '[]',
      mode: 'amoureux',
      avatar: '',
      updated_at: now(),
    });
  });

  function getUserById(userId) {
    return statements.findUserById.get(userId);
  }

  function createEmailVerification(userId, tokenHash, expiresAt) {
    statements.deleteVerificationsForUser.run(userId);
    statements.insertVerification.run(tokenHash, userId, expiresAt);
  }

  function verifyEmailToken(tokenHash) {
    const row = statements.findVerification.get(tokenHash);
    if (!row || row.expires_at < now()) {
      return null;
    }

    statements.markEmailVerified.run(now(), row.user_id);
    statements.deleteVerificationsForUser.run(row.user_id);
    return row.user_id;
  }

  function blockProfile(userId, profilePublicId) {
    const target = getProfileByPublicId(profilePublicId);
    if (!target || target.userId === userId) {
      return false;
    }

    statements.insertBlock.run(userId, target.userId, now());
    return true;
  }

  function reportProfile(userId, profilePublicId, { reason, details }) {
    const target = getProfileByPublicId(profilePublicId);
    if (!target || target.userId === userId) {
      return null;
    }

    const publicId = createPublicId('report');
    statements.insertReport.run(publicId, userId, target.userId, reason, details, now(), 'profile', '', '');
    return publicId;
  }

  function reportContent(userId, kind, ref, { reason, details }) {
    const row = kind === 'post'
      ? db.prepare('SELECT user_id AS owner, content AS excerpt FROM posts WHERE public_id = ?').get(ref)
      : db.prepare('SELECT host_user_id AS owner, title AS excerpt FROM events WHERE public_id = ?').get(ref);
    if (!row || row.owner === userId) {
      return null;
    }

    const existing = db.prepare("SELECT public_id FROM reports WHERE reporter_user_id = ? AND content_kind = ? AND content_ref = ? AND status = 'open'").get(userId, kind, ref);
    if (existing) {
      return existing.public_id;
    }

    const publicId = createPublicId('report');
    statements.insertReport.run(publicId, userId, row.owner, reason, details, now(), kind, ref, row.excerpt.slice(0, 200));
    return publicId;
  }

  function isContentHidden(kind, ref) {
    const { count } = db.prepare("SELECT COUNT(DISTINCT reporter_user_id) AS count FROM reports WHERE content_kind = ? AND content_ref = ? AND status = 'open'").get(kind, ref);
    return count >= CONTENT_HIDE_THRESHOLD;
  }

  function addProfilePhoto(userId, url) {
    const profile = getProfileByUserId(userId);
    const photos = profile?.photos ?? [];
    if (!profile || !OWN_UPLOAD.test(url) || photos.length >= MAX_PHOTOS) {
      return null;
    }
    statements.setPhotos.run(JSON.stringify([...photos, url]), userId);
    return getProfileByUserId(userId);
  }

  function removeProfilePhoto(userId, url) {
    const photos = getProfileByUserId(userId)?.photos ?? [];
    if (!photos.includes(url)) {
      return null;
    }
    statements.setPhotos.run(JSON.stringify(photos.filter((item) => item !== url)), userId);
    return getProfileByUserId(userId);
  }

  function setTonight(userId, active) {
    const row = statements.findProfileByUserId.get(userId);
    if (!row || row.mode !== 'sans-lendemain') {
      throw Object.assign(new Error('Fonctionnalité indisponible sur ce site.'), { status: 403 });
    }
    const stored = JSON.parse(row.details || '{}');
    if (active) {
      stored.tonightUntil = new Date(Date.now() + TONIGHT_DURATION_MS).toISOString();
    } else {
      delete stored.tonightUntil;
    }
    statements.setDetails.run(JSON.stringify(stored), userId);
    return getProfileByUserId(userId);
  }

  function listOpenReports() {
    return statements.listOpenReports.all().map((row) => ({
      id: row.public_id,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
      reporterEmail: row.reporter_email,
      content: { kind: row.content_kind, ref: row.content_ref, excerpt: row.content_excerpt },
      target: {
        userId: row.target_user_public_id,
        email: row.target_email,
        name: row.target_name,
        status: row.target_status,
      },
    }));
  }

  const resolveReportById = db.transaction((reportPublicId, action) => {
    const report = statements.findReport.get(reportPublicId);
    if (!report || report.status !== 'open') {
      return false;
    }

    if (action === 'remove' && report.content_kind !== 'profile') {
      if (report.content_kind === 'post') {
        db.prepare('DELETE FROM posts WHERE public_id = ?').run(report.content_ref);
      } else {
        db.prepare('DELETE FROM events WHERE public_id = ?').run(report.content_ref);
      }
      db.prepare("UPDATE reports SET status = 'actioned', resolved_at = ? WHERE content_kind = ? AND content_ref = ? AND status = 'open'").run(now(), report.content_kind, report.content_ref);
    } else if (action === 'suspend') {
      statements.setUserStatus.run('suspended', report.target_user_id);
      statements.resolveReportsForTarget.run(now(), report.target_user_id);
    } else {
      statements.resolveReport.run('dismissed', now(), report.id);
    }

    return true;
  });

  function setUserPlan({ userId, customerId, plan, planUntil, subscriptionId }) {
    const params = { plan, plan_until: planUntil ?? null, customer_id: customerId ?? null, subscription_id: subscriptionId ?? null };
    if (userId) {
      return statements.setPlanById.run({ ...params, user_id: userId }).changes > 0;
    }
    return Boolean(customerId) && statements.setPlanByCustomer.run(params).changes > 0;
  }

  function boostProfile(userId) {
    const row = statements.findProfileByUserId.get(userId);
    const cooldown = isPremium(row) ? BOOST_COOLDOWN_PREMIUM_MS : BOOST_COOLDOWN_FREE_MS;
    const nextAt = row.last_boost_at ? new Date(row.last_boost_at).getTime() + cooldown : 0;
    if (nextAt > Date.now()) {
      throw Object.assign(new Error('Boost déjà utilisé récemment.'), { status: 429, nextBoostAt: new Date(nextAt).toISOString() });
    }
    const start = now();
    db.prepare('UPDATE profiles SET boost_until = ?, last_boost_at = ? WHERE user_id = ?')
      .run(new Date(Date.now() + BOOST_DURATION_MS).toISOString(), start, userId);
    return getProfileByUserId(userId);
  }

  function submitSelfie(userId) {
    const user = statements.findUserById.get(userId);
    if (user.selfie_status === 'approved' || user.selfie_status === 'pending') {
      throw Object.assign(new Error('Vérification déjà en cours ou validée.'), { status: 409 });
    }
    db.prepare('UPDATE users SET selfie_status = ?, selfie_file = ? WHERE id = ?').run('pending', 'stored', userId);
    db.prepare("UPDATE users SET selfie_status = 'pending' WHERE email = ? AND selfie_status != 'approved'").run(user.email);
    return getProfileByUserId(userId);
  }

  function listPendingSelfies() {
    return db.prepare(`
      SELECT users.id AS user_id, users.public_id, users.email, users.site, profiles.name
      FROM users LEFT JOIN profiles ON profiles.user_id = users.id
      WHERE users.selfie_status = 'pending' AND users.selfie_file IS NOT NULL
      ORDER BY users.id
    `).all().map((row) => ({ id: row.public_id, userId: row.user_id, email: row.email, site: row.site, name: row.name ?? '' }));
  }

  function resolveSelfie(publicId, approve) {
    const user = db.prepare('SELECT * FROM users WHERE public_id = ? AND selfie_status = ?').get(publicId, 'pending');
    if (!user) return null;
    const status = approve ? 'approved' : 'rejected';
    db.prepare('UPDATE users SET selfie_status = ? WHERE email = ?').run(status, user.email);
    db.prepare('UPDATE users SET selfie_file = NULL WHERE id = ?').run(user.id);
    return user.id;
  }

  function getSelfieOwnerId(publicId) {
    return db.prepare("SELECT id FROM users WHERE public_id = ? AND selfie_status = 'pending'").get(publicId)?.id ?? null;
  }

  const COMMUNITY_ERROR = (message) => Object.assign(new Error(message), { status: 400 });

  function requireMode(userId, mode) {
    const profile = getProfileByUserId(userId);
    if (!profile || profile.mode !== mode) {
      throw Object.assign(new Error('Fonctionnalité indisponible sur ce site.'), { status: 403 });
    }
    return profile;
  }

  function isBlocked(userId, otherId) {
    return Boolean(statements.isBlockedPair.get({ a: userId, b: otherId }));
  }

  function serializeEvent(row, userId) {
    const attendees = db.prepare('SELECT COUNT(*) AS count FROM event_attendees WHERE event_id = ?').get(row.id).count;
    const joined = Boolean(db.prepare('SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id = ?').get(row.id, userId));
    return {
      id: row.public_id,
      title: row.title,
      place: row.place,
      city: row.city,
      description: row.description,
      startsAt: row.starts_at,
      capacity: row.capacity,
      attendees,
      joined,
      isHost: row.host_user_id === userId,
      hostName: row.host_name,
    };
  }

  function listEvents(userId, { city = '' } = {}) {
    requireMode(userId, 'amical');
    const wanted = `${city}`.trim().toLowerCase();
    return db.prepare(`
      SELECT events.*, profiles.name AS host_name FROM events
      JOIN users ON users.id = events.host_user_id
      JOIN profiles ON profiles.user_id = events.host_user_id
      WHERE events.starts_at >= ? AND users.status = 'active' AND profiles.mode = 'amical'
      ORDER BY events.starts_at ASC LIMIT 100
    `).all(new Date().toISOString())
      .filter((row) => !isBlocked(userId, row.host_user_id))
      .filter((row) => !isContentHidden('event', row.public_id))
      .filter((row) => !wanted || row.city.toLowerCase().includes(wanted))
      .map((row) => serializeEvent(row, userId));
  }

  function createEvent(userId, input = {}) {
    const profile = requireMode(userId, 'amical');
    const title = `${input.title ?? ''}`.trim().slice(0, 80);
    const startsAt = new Date(input.startsAt);
    const capacity = Math.round(Number(input.capacity) || 6);

    if (title.length < 3) throw COMMUNITY_ERROR('Le titre doit contenir au moins 3 caractères.');
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) throw COMMUNITY_ERROR('La date doit être dans le futur.');
    if (capacity < 2 || capacity > 50) throw COMMUNITY_ERROR('Le nombre de places doit être compris entre 2 et 50.');

    const publicId = createPublicId('event');
    const result = db.prepare(`
      INSERT INTO events (public_id, host_user_id, title, place, city, description, starts_at, capacity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      publicId,
      userId,
      title,
      `${input.place ?? ''}`.trim().slice(0, 80),
      `${input.city ?? profile.city ?? ''}`.trim().slice(0, 60),
      `${input.description ?? ''}`.trim().slice(0, 500),
      startsAt.toISOString(),
      capacity,
      now(),
    );
    db.prepare('INSERT INTO event_attendees (event_id, user_id, created_at) VALUES (?, ?, ?)').run(result.lastInsertRowid, userId, now());
    return listEvents(userId).find((event) => event.id === publicId);
  }

  function joinEvent(userId, eventPublicId) {
    requireMode(userId, 'amical');
    const event = db.prepare('SELECT * FROM events WHERE public_id = ?').get(eventPublicId);
    if (!event || isBlocked(userId, event.host_user_id)) throw Object.assign(new Error('Sortie introuvable.'), { status: 404 });
    const count = db.prepare('SELECT COUNT(*) AS count FROM event_attendees WHERE event_id = ?').get(event.id).count;
    const already = db.prepare('SELECT 1 FROM event_attendees WHERE event_id = ? AND user_id = ?').get(event.id, userId);
    if (!already && count >= event.capacity) throw Object.assign(new Error('Cette sortie est complète.'), { status: 409 });
    db.prepare('INSERT OR IGNORE INTO event_attendees (event_id, user_id, created_at) VALUES (?, ?, ?)').run(event.id, userId, now());
    return listEvents(userId).find((item) => item.id === eventPublicId);
  }

  function leaveEvent(userId, eventPublicId) {
    const event = db.prepare('SELECT * FROM events WHERE public_id = ?').get(eventPublicId);
    if (!event) return false;
    if (event.host_user_id === userId) {
      db.prepare('DELETE FROM events WHERE id = ?').run(event.id);
    } else {
      db.prepare('DELETE FROM event_attendees WHERE event_id = ? AND user_id = ?').run(event.id, userId);
    }
    return true;
  }

  function listPosts(userId) {
    requireMode(userId, 'professionnel');
    return db.prepare(`
      SELECT posts.*, profiles.name, profiles.avatar, profiles.details, users.email_verified_at
      FROM posts
      JOIN users ON users.id = posts.user_id
      JOIN profiles ON profiles.user_id = posts.user_id
      WHERE users.status = 'active' AND profiles.mode = 'professionnel'
      ORDER BY posts.created_at DESC LIMIT 50
    `).all()
      .filter((row) => !isBlocked(userId, row.user_id))
      .filter((row) => !isContentHidden('post', row.public_id))
      .map((row) => {
        const details = parseDetails(row.details);
        return {
          id: row.public_id,
          kind: row.kind,
          content: row.content,
          createdAt: row.created_at,
          authorName: row.name,
          authorAvatar: row.avatar,
          authorJob: [details.job, details.company].filter(Boolean).join(' · '),
          mine: row.user_id === userId,
        };
      });
  }

  function createPost(userId, input = {}) {
    requireMode(userId, 'professionnel');
    const content = `${input.content ?? ''}`.trim().slice(0, 1000);
    const kind = ['post', 'offre', 'recherche'].includes(input.kind) ? input.kind : 'post';
    if (content.length < 3) throw COMMUNITY_ERROR('La publication est trop courte.');
    const publicId = createPublicId('post');
    db.prepare('INSERT INTO posts (public_id, user_id, kind, content, created_at) VALUES (?, ?, ?, ?, ?)').run(publicId, userId, kind, content, now());
    return listPosts(userId).find((post) => post.id === publicId);
  }

  function deletePost(userId, postPublicId) {
    return db.prepare('DELETE FROM posts WHERE public_id = ? AND user_id = ?').run(postPublicId, userId).changes > 0;
  }

  function listLikesReceived(userId) {
    const me = requireMode(userId, 'amoureux');
    const hidden = new Set(statements.hiddenTargetIds.all(userId, userId).map((row) => row.id));
    const rows = db.prepare('SELECT user_id FROM likes WHERE target_user_id = ? ORDER BY created_at DESC LIMIT 100').all(userId)
      .filter((row) => !hidden.has(row.user_id) && !isBlocked(userId, row.user_id));
    const profiles = rows
      .map((row) => statements.findProfileByUserId.get(row.user_id))
      .filter((row) => row && row.mode === 'amoureux' && row.status === 'active')
      .map(serializePublicProfile);

    return me.plan === 'premium'
      ? { count: profiles.length, profiles, locked: false }
      : { count: profiles.length, profiles: [], locked: true };
  }

  // Vue d'ensemble du compte : une entrée par site, avec ce qui attend l'utilisateur.
  function getAccountOverview(userId) {
    const sites = {};
    for (const id of listAccountUserIds(userId)) {
      const profile = getProfileByUserId(id);
      if (!profile || profile.status === 'suspended') continue;
      const conversations = listConversationsForUser(id);
      sites[profile.mode] = {
        joined: true,
        completed: Boolean(profile.age && profile.city && profile.bio),
        matches: listMatchesForUser(id).length,
        conversations: conversations.length,
        awaitingReply: conversations.filter((c) => c.messages.at(-1)?.sender === 'them').length,
      };
    }
    return sites;
  }

  function deleteAccount(userId) {
    return statements.deleteUser.run(userId).changes > 0;
  }

  function exportUserData(userId) {
    const user = statements.findUserById.get(userId);
    return {
      account: {
        email: user.email,
        createdAt: user.created_at,
        emailVerifiedAt: user.email_verified_at,
        termsAcceptedAt: user.terms_accepted_at,
        termsVersion: user.terms_version,
        plan: user.plan,
        planUntil: user.plan_until,
      },
      profile: getProfileByUserId(userId),
      likesGiven: statements.listLikesGiven.all(userId).map((row) => ({ profileId: row.profile_id, createdAt: row.created_at })),
      matches: listMatchesForUser(userId),
      conversations: listConversationsForUser(userId),
    };
  }

  return {
    db,
    createUser,
    getUserByEmail,
    getUserById,
    getAccountByEmail,
    listAccountUserIds,
    getAccountOverview,
    joinSite,
    createEmailVerification,
    verifyEmailToken,
    blockProfile,
    reportProfile,
    listOpenReports,
      reportContent,
      addProfilePhoto,
      removeProfilePhoto,
      setTonight,
    resolveReportById,
    deleteAccount,
    listEvents,
    createEvent,
    joinEvent,
    leaveEvent,
    listPosts,
    createPost,
    deletePost,
    listLikesReceived,
    setUserPlan,
    exportUserData,
    getProfileByUserId,
    getProfileByPublicId,
    updateUserProfile,
    listDiscoveryProfiles,
    boostProfile,
    submitSelfie,
    listPendingSelfies,
    resolveSelfie,
    getSelfieOwnerId,
    likeProfile,
    passProfile,
    listMatchesForUser,
    listConversationsForUser,
    markConversationRead,
    addMessage,
    resetUserData,
  };
}

function seedDemoData(db, statements) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users WHERE is_demo = 1').get();
  if (existing.count > 0) {
    for (const demoProfile of DEMO_PROFILES) {
      statements.setProfileDetailsIfEmpty.run(JSON.stringify(sanitizeDetails(demoProfile.mode, demoProfile.details)), demoProfile.id);
    }
    return;
  }

  const transaction = db.transaction(() => {
    const createdAt = now();

    for (const demoProfile of DEMO_PROFILES) {
      const userResult = statements.insertUser.run({
        public_id: `user-${demoProfile.id}`,
        email: `demo-${demoProfile.id}@lifys.local`,
        password_hash: 'demo-account',
        is_demo: 1,
        created_at: createdAt,
        terms_accepted_at: null,
        terms_version: null,
        email_verified_at: createdAt,
        site: demoProfile.mode,
      });

      statements.insertProfile.run({
        user_id: userResult.lastInsertRowid,
        public_id: demoProfile.id,
        name: demoProfile.name,
        age: demoProfile.age,
        city: demoProfile.city,
        bio: demoProfile.bio,
        interests: JSON.stringify(normalizeInterests(demoProfile.interests)),
        mode: demoProfile.mode,
        avatar: demoProfile.avatar,
        created_at: createdAt,
        updated_at: createdAt,
      });
      statements.setProfileDetailsIfEmpty.run(JSON.stringify(sanitizeDetails(demoProfile.mode, demoProfile.details)), demoProfile.id);
    }
  });

  transaction();
}



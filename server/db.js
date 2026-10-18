import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import Database from 'better-sqlite3';

import { DEMO_PROFILES, MODES } from '../src/data/demoData.js';
import { normalizeEmail } from './auth.js';

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

export function sanitizeProfileInput(value = {}) {
  const age = Number(value.age);
  const avatar = `${value.avatar ?? ''}`.trim();

  return {
    name: `${value.name ?? ''}`.trim(),
    age: Number.isFinite(age) && age >= 18 && age <= 80 ? age : null,
    city: `${value.city ?? ''}`.trim(),
    bio: `${value.bio ?? ''}`.trim(),
    interests: normalizeInterests(value.interests),
    mode: MODE_IDS.has(value.mode) ? value.mode : 'amoureux',
    avatar: avatar && /^https?:\/\//i.test(avatar) ? avatar : '',
  };
}

function parseInterests(rawValue) {
  try {
    return normalizeInterests(JSON.parse(rawValue ?? '[]'));
  } catch {
    return [];
  }
}

function isPremium(row) {
  return row.plan === 'premium' && (!row.plan_until || new Date(row.plan_until).getTime() > Date.now());
}

function serializeProfile(row) {
  return {
    id: row.public_id,
    userId: row.user_id,
    userPublicId: row.user_public_id,
    email: row.email,
    emailVerified: Boolean(row.email_verified_at),
    plan: isPremium(row) ? 'premium' : 'free',
    name: row.name,
    age: row.age,
    city: row.city,
    bio: row.bio,
    interests: parseInterests(row.interests),
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
    mode: row.mode,
    avatar: row.avatar,
    isDemo: Boolean(row.is_demo),
  };
}

function serializeMatch(row) {
  return {
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
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
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
  ]) {
    if (!userColumns.has(column)) {
      db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`);
    }
  }
  db.exec('UPDATE users SET email_verified_at = created_at WHERE is_demo = 1 AND email_verified_at IS NULL');

  const statements = {
    insertUser: db.prepare(`
      INSERT INTO users (public_id, email, password_hash, is_demo, created_at, terms_accepted_at, terms_version, email_verified_at)
      VALUES (@public_id, @email, @password_hash, @is_demo, @created_at, @terms_accepted_at, @terms_version, @email_verified_at)
    `),
    insertProfile: db.prepare(`
      INSERT INTO profiles (user_id, public_id, name, age, city, bio, interests, mode, avatar, created_at, updated_at)
      VALUES (@user_id, @public_id, @name, @age, @city, @bio, @interests, @mode, @avatar, @created_at, @updated_at)
    `),
    findUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
    findUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
    findProfileByUserId: db.prepare(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.is_demo, users.email_verified_at, users.status, users.plan, users.plan_until
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.user_id = ?
    `),
    findProfileByPublicId: db.prepare(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.is_demo, users.email_verified_at, users.status, users.plan, users.plan_until
      FROM profiles
      JOIN users ON users.id = profiles.user_id
      WHERE profiles.public_id = ?
    `),
    listProfilesExcludingUser: db.prepare(`
      SELECT profiles.*, users.public_id AS user_public_id, users.email, users.is_demo, users.email_verified_at, users.status, users.plan, users.plan_until
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
    setPlanById: db.prepare(`UPDATE users SET plan = @plan, plan_until = @plan_until, stripe_customer_id = COALESCE(@customer_id, stripe_customer_id), stripe_subscription_id = COALESCE(@subscription_id, stripe_subscription_id) WHERE id = @user_id`),
    markEmailVerified: db.prepare(`UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL`),
    insertBlock: db.prepare(`INSERT OR IGNORE INTO blocks (user_id, blocked_user_id, created_at) VALUES (?, ?, ?)`),
    isBlockedPair: db.prepare(`
      SELECT 1 FROM blocks
      WHERE (user_id = @a AND blocked_user_id = @b) OR (user_id = @b AND blocked_user_id = @a)
      LIMIT 1
    `),
    insertReport: db.prepare(`
      INSERT INTO reports (public_id, reporter_user_id, target_user_id, reason, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    listOpenReports: db.prepare(`
      SELECT reports.public_id, reports.reason, reports.details, reports.created_at,
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
    setUserStatus: db.prepare(`UPDATE users SET status = ? WHERE id = ?`),
    deleteUser: db.prepare(`DELETE FROM users WHERE id = ? AND is_demo = 0`),
    deleteDemoUsers: db.prepare(`DELETE FROM users WHERE is_demo = 1`),
    listLikesGiven: db.prepare(`
      SELECT profiles.public_id AS profile_id, likes.created_at FROM likes
      JOIN profiles ON profiles.user_id = likes.target_user_id WHERE likes.user_id = ?
    `),
    updateProfile: db.prepare(`
      UPDATE profiles
      SET name = @name, age = @age, city = @city, bio = @bio, interests = @interests, mode = @mode, avatar = @avatar, updated_at = @updated_at
      WHERE user_id = @user_id
    `),
    upsertLike: db.prepare(`INSERT OR IGNORE INTO likes (user_id, target_user_id, created_at) VALUES (?, ?, ?)`),
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
      SELECT messages.public_id, messages.content, messages.created_at, messages.sender_user_id
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

  function getUserByEmail(email) {
    return statements.findUserByEmail.get(normalizeEmail(email));
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
    statements.updateProfile.run({
      user_id: userId,
      name: profile.name,
      age: profile.age,
      city: profile.city,
      bio: profile.bio,
      interests: JSON.stringify(profile.interests),
      mode: profile.mode,
      avatar: profile.avatar,
      updated_at: now(),
    });
    return getProfileByUserId(userId);
  }

  function listDiscoveryProfiles(userId, filters = {}) {
    const hiddenUserIds = new Set(statements.hiddenTargetIds.all(userId, userId).map((row) => row.id));
    const activeMode = `${filters.activeMode ?? 'all'}`;
    const query = `${filters.query ?? ''}`.trim().toLowerCase();
    const city = `${filters.city ?? ''}`.trim().toLowerCase();

    return statements.listProfilesExcludingUser.all({ user_id: userId, include_unverified: requireEmailVerification ? 0 : 1 })
      .filter((row) => !hiddenUserIds.has(row.user_id))
      .map(serializePublicProfile)
      .filter((profile) => activeMode === 'all' || profile.mode === activeMode)
      .filter((profile) => !city || profile.city.toLowerCase().includes(city))
      .filter((profile) => {
        if (!query) {
          return true;
        }

        return [profile.name, profile.city, profile.bio, ...profile.interests]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
  }

  function getOrCreateMatch(userId, targetUserId, currentProfile, targetProfile) {
    const key = pairKey(userId, targetUserId);
    const reciprocal = Boolean(statements.hasReciprocalLike.get(targetUserId, userId));
    const reason = buildMatchReason(currentProfile, targetProfile, reciprocal);
    const createdAt = now();

    statements.insertMatch.run(
      createPublicId('match'),
      key,
      Math.min(userId, targetUserId),
      Math.max(userId, targetUserId),
      reason,
      createdAt,
    );

    const matchRow = statements.findMatchByPairKey.get(key);
    statements.insertConversation.run(createPublicId('conversation'), matchRow.id, createdAt);
    const conversationRow = statements.findConversationByMatchId.get(matchRow.id);
    const existingMessages = statements.listMessagesForConversation.all({
      conversation_public_id: conversationRow.public_id,
      user_id: userId,
    });

    if (!existingMessages.length) {
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

  function likeProfile(userId, profilePublicId) {
    const currentProfile = getProfileByUserId(userId);
    const targetProfile = getProfileByPublicId(profilePublicId);

    if (!currentProfile || !targetProfile || targetProfile.userId === userId) {
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

    statements.upsertLike.run(userId, targetProfile.userId, now());
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
    return statements.listMatchesForUser.all({ user_id: userId }).map(serializeMatch);
  }

  function listConversationsForUser(userId) {
    return statements.listConversationsForUser.all({ user_id: userId }).map((conversation) => ({
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
      })),
    }));
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
    statements.insertMessage.run(createPublicId('message'), conversation.id, userId, `${text}`.trim(), now());
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
    statements.insertReport.run(publicId, userId, target.userId, reason, details, now());
    return publicId;
  }

  function listOpenReports() {
    return statements.listOpenReports.all().map((row) => ({
      id: row.public_id,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
      reporterEmail: row.reporter_email,
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

    if (action === 'suspend') {
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
    createEmailVerification,
    verifyEmailToken,
    blockProfile,
    reportProfile,
    listOpenReports,
    resolveReportById,
    deleteAccount,
    setUserPlan,
    exportUserData,
    getProfileByUserId,
    getProfileByPublicId,
    updateUserProfile,
    listDiscoveryProfiles,
    likeProfile,
    passProfile,
    listMatchesForUser,
    listConversationsForUser,
    addMessage,
    resetUserData,
  };
}

function seedDemoData(db, statements) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users WHERE is_demo = 1').get();
  if (existing.count > 0) {
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
    }
  });

  transaction();
}


